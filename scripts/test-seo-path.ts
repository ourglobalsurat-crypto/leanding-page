import assert from "node:assert/strict";

import { defaultQuestions } from "../src/lib/default-questionnaire";
import {
  getExpectedQuestionCount,
  getVisibleQuestions,
  pruneHiddenAnswers,
  validateQuestionnaireFlow,
} from "../src/lib/questionnaire-flow";
import { growthPaths, growthTracks, type PublicQuestion } from "../src/lib/types";
import { planSeoPublish } from "./publish-seo-path";

/**
 * Checks the SEO path, the Lead Generation and D2C tracks inside it, and the
 * migration that adds all of it to a live questionnaire. Nothing here touches a
 * database: planSeoPublish() is given a draft in memory and its plan is
 * inspected, so the publish can be reviewed before it is run against real data.
 */

const checks: string[] = [];
function check(name: string, run: () => void) {
  run();
  checks.push(name);
}

function keys(questions: readonly PublicQuestion[]) {
  return questions.map((question) => question.key);
}

/** The two-path questionnaire as it exists in an installation before the migration. */
function legacyDraft(): PublicQuestion[] {
  return defaultQuestions
    .filter((question) => question.config.flow !== "seo")
    .map((question, index) => ({
      ...question,
      id: `db-${question.key}`,
      position: index + 1,
      options:
        question.config.systemRole === "flow_selector"
          ? question.options.filter((option) => option.id !== "seo")
          : question.options,
    }));
}

check("every path produces a submittable questionnaire", () => {
  assert.equal(validateQuestionnaireFlow(defaultQuestions), null);
  for (const path of growthPaths) {
    const visible = getVisibleQuestions(defaultQuestions, { growth_path: path });
    assert.equal(visible[0]?.key, "growth_path");
    assert.deepEqual(keys(visible.slice(-2)), ["full_name", "phone"]);
  }
});

check("the two original options are exactly as they were", () => {
  const selector = defaultQuestions.find(
    (question) => question.config.systemRole === "flow_selector",
  );
  assert.ok(selector);
  assert.deepEqual(selector.options.map((option) => option.id), [
    "lead_generation",
    "d2c_growth",
    "seo",
  ]);

  // Adding SEO must never reword the two options that were already live.
  const [leadGeneration, d2c] = selector.options;
  assert.equal(leadGeneration.label.en, "Get more enquiries");
  assert.equal(
    leadGeneration.description?.en,
    "Lead Generation: for service, local and B2B businesses",
  );
  assert.equal(d2c.label.en, "Grow online product sales");
  assert.equal(
    d2c.description?.en,
    "D2C Growth: for brands selling through a website or online store",
  );
});

check("no visitor-facing text contains an em dash", () => {
  const emDash = "—";
  for (const question of defaultQuestions) {
    const strings = [
      ...Object.values(question.label),
      ...Object.values(question.helpText),
      ...Object.values(question.placeholder),
      ...question.options.flatMap((option) => [
        ...Object.values(option.label),
        ...Object.values(option.description ?? {}),
      ]),
    ];
    for (const value of strings) {
      assert.ok(!value.includes(emDash), `${question.key} still contains an em dash: ${value}`);
    }
  }
});

check("the paid paths stay untouched by the SEO work", () => {
  assert.deepEqual(keys(getVisibleQuestions(defaultQuestions, { growth_path: "lead_generation" })), [
    "growth_path",
    "lead_business_model",
    "lead_target_location",
    "lead_campaign_experience",
    "full_name",
    "phone",
  ]);
  assert.deepEqual(keys(getVisibleQuestions(defaultQuestions, { growth_path: "d2c_growth" })), [
    "growth_path",
    "website_url",
    "monthly_online_revenue",
    "monthly_ad_budget",
    "full_name",
    "phone",
  ]);
});

check("choosing SEO asks for the goal first, then the website", () => {
  const visible = getVisibleQuestions(defaultQuestions, { growth_path: "seo" });
  assert.deepEqual(keys(visible), [
    "growth_path",
    "seo_goal",
    "seo_website_url",
    "seo_experience",
    "seo_monthly_budget",
    "full_name",
    "phone",
  ]);
  // The track-only questions stay hidden until the track selector is answered.
  assert.ok(!keys(visible).includes("seo_lead_target_location"));
  assert.ok(!keys(visible).includes("seo_d2c_monthly_sales"));
});

check("the SEO Lead Generation track asks where customers should come from", () => {
  const visible = getVisibleQuestions(defaultQuestions, {
    growth_path: "seo",
    seo_goal: "lead_generation",
  });
  assert.deepEqual(keys(visible), [
    "growth_path",
    "seo_goal",
    "seo_website_url",
    "seo_lead_target_location",
    "seo_experience",
    "seo_monthly_budget",
    "full_name",
    "phone",
  ]);
});

check("the SEO D2C Growth track asks about monthly online sales instead", () => {
  const visible = getVisibleQuestions(defaultQuestions, {
    growth_path: "seo",
    seo_goal: "d2c_growth",
  });
  assert.deepEqual(keys(visible), [
    "growth_path",
    "seo_goal",
    "seo_website_url",
    "seo_d2c_monthly_sales",
    "seo_experience",
    "seo_monthly_budget",
    "full_name",
    "phone",
  ]);
});

check("every SEO question is required and fully translated", () => {
  for (const question of defaultQuestions.filter((item) => item.config.flow === "seo")) {
    assert.ok(question.required, `${question.key} should be required`);
    for (const field of ["label", "helpText"] as const) {
      const text = question[field];
      assert.ok(text.en && text.hi && text.gu, `${question.key}.${field} is missing a translation`);
    }
    if (question.type === "single_choice") {
      assert.ok(question.options.length >= 2, `${question.key} needs real options`);
      for (const option of question.options) {
        assert.ok(
          option.label.en && option.label.hi && option.label.gu,
          `${question.key}/${option.id} is missing a translation`,
        );
      }
    }
  }
});

check("the progress count narrows with the branch and never grows", () => {
  const count = (answers: Record<string, unknown>) =>
    getExpectedQuestionCount(defaultQuestions, answers);

  assert.equal(count({}), 8);
  assert.equal(count({ growth_path: "seo" }), 8);
  assert.equal(count({ growth_path: "seo", seo_goal: "lead_generation" }), 8);
  assert.equal(count({ growth_path: "seo", seo_goal: "d2c_growth" }), 8);

  // A goal that leads to no track settles the branch one question shorter.
  for (const goal of ["local_customers", "website_traffic", "google_rankings", "not_sure"]) {
    assert.equal(count({ growth_path: "seo", seo_goal: goal }), 7, `${goal} count`);
  }

  assert.equal(count({ growth_path: "lead_generation" }), 6);
  assert.equal(count({ growth_path: "d2c_growth" }), 6);
});

check("a goal outside the two tracks skips the track question", () => {
  for (const goal of ["local_customers", "website_traffic", "google_rankings", "not_sure"]) {
    const visible = getVisibleQuestions(defaultQuestions, { growth_path: "seo", seo_goal: goal });
    assert.deepEqual(keys(visible), [
      "growth_path",
      "seo_goal",
      "seo_website_url",
      "seo_experience",
      "seo_monthly_budget",
      "full_name",
      "phone",
    ], `${goal} shows the wrong questions`);
  }
});

check("switching track or path drops the answers left behind", () => {
  const answers = {
    growth_path: "seo",
    seo_goal: "d2c_growth",
    seo_d2c_monthly_sales: "under_1l",
    seo_lead_target_location: "gujarat",
    lead_business_model: "b2b",
    website_url: "https://left-over.example",
  };
  assert.deepEqual(Object.keys(pruneHiddenAnswers(defaultQuestions, answers)).sort(), [
    "growth_path",
    "seo_d2c_monthly_sales",
    "seo_goal",
  ]);
});

check("a questionnaire whose track has nowhere to go is refused", () => {
  const stripped = defaultQuestions.filter(
    (question) => question.key !== "seo_lead_target_location",
  );
  assert.match(String(validateQuestionnaireFlow(stripped)), /Lead Generation track/);

  const orphanTrack = defaultQuestions.map((question) =>
    question.key === "lead_business_model"
      ? { ...question, config: { ...question.config, track: "d2c_growth" as const } }
      : question,
  );
  assert.match(String(validateQuestionnaireFlow(orphanTrack)), /no path-track selector/);
});

check("the track selector must open its own path", () => {
  const moved = defaultQuestions.map((question) =>
    question.key === "seo_goal" ? { ...question, position: 99 } : question,
  );
  assert.match(
    String(validateQuestionnaireFlow(moved)),
    /path-track selector must be the first visible question of its path/,
  );
});

check("the migration appends SEO without disturbing the existing paths", () => {
  const draft = legacyDraft();
  const plan = planSeoPublish(draft);
  assert.ok(plan, "the legacy draft should need the migration");

  assert.equal(plan.selectorNeedsOption, true);
  assert.deepEqual(plan.selectorOptions.map((option) => option.id), [
    "lead_generation",
    "d2c_growth",
    "seo",
  ]);
  assert.deepEqual(keys(plan.missingSeoQuestions), [
    "seo_goal",
    "seo_website_url",
    "seo_lead_target_location",
    "seo_d2c_monthly_sales",
    "seo_experience",
    "seo_monthly_budget",
  ]);

  // Existing questions keep their database rows and their admin-edited copy.
  const kept = plan.ordered.filter((question) => question.id.startsWith("db-"));
  assert.equal(kept.length, draft.length);
  for (const question of kept) {
    const before = draft.find((original) => original.id === question.id);
    assert.ok(before);
    assert.deepEqual(question.label, before.label);
    assert.equal(question.key, before.key);
  }

  assert.deepEqual(
    plan.ordered.map((question) => question.position),
    plan.ordered.map((_, index) => index + 1),
  );
  assert.deepEqual(keys(plan.ordered.slice(-2)), ["full_name", "phone"]);
  assert.equal(validateQuestionnaireFlow(plan.ordered), null);

  // And the migrated form behaves like the defaults.
  for (const track of growthTracks) {
    const visible = getVisibleQuestions(plan.ordered, { growth_path: "seo", seo_goal: track });
    assert.equal(visible.length, 8);
  }
});

check("admin wording edits survive the migration", () => {
  const draft = legacyDraft().map((question) =>
    question.config.systemRole === "flow_selector"
      ? { ...question, label: { ...question.label, en: "Edited by an admin" } }
      : question,
  );
  const plan = planSeoPublish(draft);
  assert.ok(plan);
  const selector = plan.ordered.find((question) => question.config.systemRole === "flow_selector");
  assert.equal(selector?.label.en, "Edited by an admin");
  assert.equal(selector?.options.length, 3);
});

check("running the migration twice changes nothing the second time", () => {
  const first = planSeoPublish(legacyDraft());
  assert.ok(first);
  assert.equal(planSeoPublish(first.ordered), null);
  assert.equal(planSeoPublish(defaultQuestions), null);
});

check("a draft with no service-path selector is refused", () => {
  const draft = legacyDraft().filter(
    (question) => question.config.systemRole !== "flow_selector",
  );
  assert.throws(() => planSeoPublish(draft), /service-path selector/);
});

for (const name of checks) console.log(`  ok   ${name}`);
console.log(`\nAll ${checks.length} SEO path checks passed.`);
