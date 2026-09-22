import {
  growthPathLabels,
  growthPaths,
  growthTrackLabels,
  growthTracks,
  type GrowthPath,
  type GrowthTrack,
  type PublicQuestion,
  type SystemQuestionRole,
} from "@/lib/types";

type AnswerMap = Record<string, unknown>;

const systemRoleLabels: Record<SystemQuestionRole, string> = {
  flow_selector: "service-path selector",
  track_selector: "path-track selector",
  contact_name: "contact-name question",
  contact_phone: "contact-phone question",
};

export function isGrowthPath(value: unknown): value is GrowthPath {
  return typeof value === "string" && growthPaths.some((path) => path === value);
}

export function isGrowthTrack(value: unknown): value is GrowthTrack {
  return typeof value === "string" && growthTracks.some((track) => track === value);
}

function findActiveFlowSelector(questions: readonly PublicQuestion[]) {
  return questions.find(
    (question) => question.isActive && question.config.systemRole === "flow_selector",
  );
}

function findActiveTrackSelector(questions: readonly PublicQuestion[], path: GrowthPath) {
  return questions.find(
    (question) =>
      question.isActive &&
      question.config.systemRole === "track_selector" &&
      question.config.flow === path,
  );
}

export function getSelectedGrowthPath(
  questions: readonly PublicQuestion[],
  answers: AnswerMap,
): GrowthPath | null {
  const selector = findActiveFlowSelector(questions);
  if (!selector) return null;

  const answer = answers[selector.key];
  return isGrowthPath(answer) ? answer : null;
}

export function getSelectedGrowthTrack(
  questions: readonly PublicQuestion[],
  answers: AnswerMap,
): GrowthTrack | null {
  const path = getSelectedGrowthPath(questions, answers);
  if (!path) return null;

  const selector = findActiveTrackSelector(questions, path);
  if (!selector) return null;

  const answer = answers[selector.key];
  return isGrowthTrack(answer) ? answer : null;
}

export function getVisibleQuestions(
  questions: readonly PublicQuestion[],
  answers: AnswerMap,
): PublicQuestion[] {
  const selector = findActiveFlowSelector(questions);

  // Recently archived questionnaires can still be submitted for 24 hours. Those
  // legacy versions have no selector and must keep their original linear flow.
  if (!selector) return [...questions];

  const selectedPath = getSelectedGrowthPath(questions, answers);
  const selectedTrack = getSelectedGrowthTrack(questions, answers);

  return questions.filter((question) => {
    if (question.id === selector.id) return true;

    if (question.config.flow !== undefined) {
      if (selectedPath === null || question.config.flow !== selectedPath) return false;
    }

    // A track-limited question waits for its path's own selector to be answered.
    if (question.config.track !== undefined) {
      return selectedTrack !== null && question.config.track === selectedTrack;
    }

    return true;
  });
}

/**
 * How many questions the visitor should expect to answer.
 *
 * Paths and tracks differ in length, and the branch is not known until its
 * selector is answered, so the count is the longest run still reachable from
 * the current answers. It only ever shrinks as the visitor narrows the branch,
 * which keeps the progress bar from jumping backwards.
 */
export function getExpectedQuestionCount(
  questions: readonly PublicQuestion[],
  answers: AnswerMap,
): number {
  const selector = findActiveFlowSelector(questions);
  const visibleCount = getVisibleQuestions(questions, answers).length;
  if (!selector) return visibleCount;

  const selectedPath = getSelectedGrowthPath(questions, answers);
  const selectedTrack = getSelectedGrowthTrack(questions, answers);
  const reachablePaths = selectedPath ? [selectedPath] : growthPaths;

  let longest = visibleCount;
  for (const path of reachablePaths) {
    const trackSelector = findActiveTrackSelector(questions, path);
    const reachableTracks: ReadonlyArray<GrowthTrack | null> = !trackSelector
      ? [null]
      : selectedTrack
        ? [selectedTrack]
        : growthTracks;

    for (const track of reachableTracks) {
      const branch: AnswerMap = { ...answers, [selector.key]: path };
      if (trackSelector && track) branch[trackSelector.key] = track;
      longest = Math.max(longest, getVisibleQuestions(questions, branch).length);
    }
  }

  return longest;
}

export function pruneHiddenAnswers(
  questions: readonly PublicQuestion[],
  answers: AnswerMap,
): AnswerMap {
  const visibleKeys = new Set(
    getVisibleQuestions(questions, answers).map((question) => question.key),
  );

  return Object.fromEntries(
    Object.entries(answers).filter(([questionKey]) => visibleKeys.has(questionKey)),
  );
}

/**
 * Rules for the second branching level. A path may carry one track selector;
 * when it does, that selector opens the path and every track needs somewhere
 * to go, so no visitor can answer it into an empty branch.
 */
function validateTracks(
  questions: readonly PublicQuestion[],
  activeQuestions: readonly PublicQuestion[],
): string | null {
  const trackSelectorPaths = new Set<GrowthPath>();

  for (const trackSelector of questions.filter(
    (question) => question.config.systemRole === "track_selector",
  )) {
    const path = trackSelector.config.flow;
    if (path === undefined || !isGrowthPath(path)) {
      return "A path-track selector must belong to one form path.";
    }
    if (trackSelectorPaths.has(path)) {
      return `The ${growthPathLabels[path]} path must contain at most one path-track selector.`;
    }
    trackSelectorPaths.add(path);

    const label = growthPathLabels[path];
    if (!trackSelector.isActive) return `The ${label} path-track selector must be visible.`;
    if (!trackSelector.required) return `The ${label} path-track selector must be required.`;
    if (trackSelector.type !== "single_choice") {
      return `The ${label} path-track selector must use the Single choice answer type.`;
    }
    if (trackSelector.config.track !== undefined) {
      return `The ${label} path-track selector must be shared by every track of its path.`;
    }

    const optionIds = trackSelector.options.map((option) => option.id);
    const uniqueOptionIds = new Set(optionIds);
    if (
      optionIds.length !== growthTracks.length ||
      uniqueOptionIds.size !== growthTracks.length ||
      growthTracks.some((track) => !uniqueOptionIds.has(track))
    ) {
      return `The ${label} path-track selector must keep exactly these options: ${growthTracks
        .map((track) => growthTrackLabels[track])
        .join(", ")}.`;
    }

    const pathQuestions = activeQuestions.filter((question) => question.config.flow === path);
    if (pathQuestions[0]?.id !== trackSelector.id) {
      return `The ${label} path-track selector must be the first visible question of its path.`;
    }

    for (const track of growthTracks) {
      if (
        !activeQuestions.some(
          (question) =>
            question.config.flow === path &&
            question.config.track === track &&
            !question.config.systemRole,
        )
      ) {
        return `Add at least one visible question to the ${label} ${growthTrackLabels[track]} track.`;
      }
    }
  }

  for (const question of questions) {
    if (question.config.track === undefined) continue;

    const name = question.label.en || question.key;
    if (!isGrowthTrack(question.config.track)) {
      return `Question "${name}" has an invalid path track.`;
    }

    const path = question.config.flow;
    if (path === undefined) {
      return `Question "${name}" must belong to a form path before it can belong to a track.`;
    }
    if (!trackSelectorPaths.has(path)) {
      return `The ${growthPathLabels[path]} path has no path-track selector, so "${name}" cannot be limited to one track.`;
    }
  }

  return null;
}

export function validateQuestionnaireFlow(
  questions: readonly PublicQuestion[],
): string | null {
  const selectors = questions.filter(
    (question) => question.config.systemRole === "flow_selector",
  );
  if (selectors.length !== 1) {
    return "The questionnaire must contain exactly one service-path selector.";
  }

  const selector = selectors[0];
  if (!selector.isActive) return "The service-path selector must be visible.";
  if (!selector.required) return "The service-path selector must be required.";
  if (selector.type !== "single_choice") {
    return "The service-path selector must use the Single choice answer type.";
  }
  if (selector.config.flow !== undefined) {
    return "The service-path selector must be shared by every form path.";
  }

  const selectorOptionIds = selector.options.map((option) => option.id);
  const uniqueSelectorOptionIds = new Set(selectorOptionIds);
  if (
    selectorOptionIds.length !== growthPaths.length ||
    uniqueSelectorOptionIds.size !== growthPaths.length ||
    growthPaths.some((path) => !uniqueSelectorOptionIds.has(path))
  ) {
    return `The service-path selector must keep exactly these options: ${growthPaths
      .map((path) => growthPathLabels[path])
      .join(", ")}.`;
  }

  const activeQuestions = questions
    .filter((question) => question.isActive)
    .sort((left, right) => left.position - right.position);
  if (activeQuestions[0]?.id !== selector.id) {
    return "The service-path selector must be the first visible question.";
  }

  for (const question of questions) {
    if (question.config.flow !== undefined && !isGrowthPath(question.config.flow)) {
      return `Question "${question.label.en || question.key}" has an invalid form path.`;
    }
  }

  for (const path of growthPaths) {
    if (
      !activeQuestions.some(
        (question) => question.config.flow === path && !question.config.systemRole,
      )
    ) {
      return `Add at least one visible question to the ${growthPathLabels[path]} path.`;
    }
  }

  const trackIssue = validateTracks(questions, activeQuestions);
  if (trackIssue) return trackIssue;

  const requiredSystemQuestions: Array<{
    role: Exclude<SystemQuestionRole, "flow_selector" | "track_selector">;
    type: PublicQuestion["type"];
  }> = [
    { role: "contact_name", type: "short_text" },
    { role: "contact_phone", type: "phone" },
  ];

  for (const { role, type } of requiredSystemQuestions) {
    const matches = questions.filter((question) => question.config.systemRole === role);
    if (matches.length !== 1) {
      return `The questionnaire must contain exactly one ${systemRoleLabels[role]}.`;
    }

    const question = matches[0];
    if (!question.isActive || !question.required) {
      return `The ${systemRoleLabels[role]} must be visible and required.`;
    }
    if (question.type !== type) {
      const expected = type === "phone" ? "Phone" : "Short text";
      return `The ${systemRoleLabels[role]} must use the ${expected} answer type.`;
    }
    if (question.config.flow !== undefined) {
      return `The ${systemRoleLabels[role]} must be shared by every form path.`;
    }
  }

  return null;
}
