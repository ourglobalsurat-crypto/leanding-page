"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CopyPlus,
  Eye,
  GripVertical,
  Plus,
  Rocket,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { languageNames } from "@/lib/copy";
import {
  growthPathLabels,
  growthPaths,
  growthTrackLabels,
  growthTracks,
  locales,
  questionTypes,
  type GrowthPath,
  type GrowthTrack,
  type Locale,
  type PublicQuestion,
  type PublicQuestionnaire,
  type QuestionOption,
  type QuestionType,
} from "@/lib/types";

const typeLabels: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  single_choice: "Single choice",
  multi_choice: "Checkboxes",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  date: "Date",
  rating: "Rating",
};

const choiceTypes = new Set<QuestionType>(["single_choice", "multi_choice", "dropdown"]);

const flowLabels: Record<"all" | GrowthPath, string> = {
  all: "All paths",
  ...growthPathLabels,
};

function questionFlowLabel(question: PublicQuestion) {
  const flow = flowLabels[question.config.flow ?? "all"];
  const track = question.config.track;
  return track ? `${flow} · ${growthTrackLabels[track]}` : flow;
}

/** Only a path that branches again can have its questions limited to a track. */
function pathHasTracks(questions: readonly PublicQuestion[], flow: GrowthPath | undefined) {
  if (!flow) return false;
  return questions.some(
    (question) => question.config.systemRole === "track_selector" && question.config.flow === flow,
  );
}

function blankLocalized() {
  return { en: "", hi: "", gu: "" };
}

function makeOption(index: number): QuestionOption {
  return {
    id: `option_${crypto.randomUUID().slice(0, 8)}`,
    label: { en: `Option ${index}`, hi: "", gu: "" },
    description: blankLocalized(),
  };
}

function makeQuestion(position: number): PublicQuestion {
  return {
    id: "",
    key: `question_${Date.now()}`,
    type: "short_text",
    label: blankLocalized(),
    helpText: blankLocalized(),
    placeholder: blankLocalized(),
    required: false,
    position,
    options: [],
    config: {},
    isActive: true,
  };
}

export function QuestionnaireBuilder({ questionnaire }: { questionnaire: PublicQuestionnaire }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(questionnaire.questions);
  const [editing, setEditing] = useState<PublicQuestion | null>(null);
  const [editorLocale, setEditorLocale] = useState<Locale>("en");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editingIsSystemQuestion = Boolean(editing?.config.systemRole);
  const editingIsBranchSelector =
    editing?.config.systemRole === "flow_selector" ||
    editing?.config.systemRole === "track_selector";
  const editingPathHasTracks = pathHasTracks(questions, editing?.config.flow);

  // A Next.js server refresh is the external source of truth after a mutation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setQuestions(questionnaire.questions), [questionnaire]);

  function openEditor(question?: PublicQuestion) {
    setError("");
    setNotice("");
    setEditorLocale("en");
    setEditing(question ? structuredClone(question) : makeQuestion(questions.length + 1));
  }

  function updateLocalized(
    field: "label" | "helpText" | "placeholder",
    value: string,
  ) {
    setEditing((current) =>
      current
        ? { ...current, [field]: { ...current[field], [editorLocale]: value } }
        : current,
    );
  }

  function updateOption(index: number, field: "label" | "description", value: string) {
    setEditing((current) => {
      if (!current) return current;
      const options = current.options.map((option, optionIndex) => {
        if (optionIndex !== index) return option;
        const localized = option[field] ?? blankLocalized();
        return { ...option, [field]: { ...localized, [editorLocale]: value } };
      });
      return { ...current, options };
    });
  }

  function changeType(type: QuestionType) {
    setEditing((current) => {
      if (!current) return current;
      const needsOptions = choiceTypes.has(type);
      return {
        ...current,
        type,
        options: needsOptions && current.options.length < 2 ? [makeOption(1), makeOption(2)] : current.options,
      };
    });
  }

  function changeFlow(value: "all" | GrowthPath) {
    const flow = value === "all" ? undefined : value;
    setEditing((current) =>
      current
        ? {
            ...current,
            config: {
              ...current.config,
              flow,
              track: pathHasTracks(questions, flow) ? current.config.track : undefined,
            },
          }
        : current,
    );
  }

  function changeTrack(value: "all" | GrowthTrack) {
    setEditing((current) =>
      current
        ? {
            ...current,
            config: {
              ...current.config,
              track: value === "all" ? undefined : value,
            },
          }
        : current,
    );
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setIsSaving(true);

    const response = await fetch(editing.id ? `/api/admin/questions/${editing.id}` : "/api/admin/questions", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: editing.key,
        type: editing.type,
        label: editing.label,
        helpText: editing.helpText,
        placeholder: editing.placeholder,
        required: editing.required,
        options: editing.options,
        config: editing.config.systemRole
          ? { ...editing.config, flow: undefined }
          : editing.config,
        isActive: editing.isActive,
      }),
    });
    const result = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !result.ok) {
      setError(result.message || "Could not save the question.");
    } else {
      setEditing(null);
      setNotice(editing.id ? "Question updated in the draft." : "Question added to the draft.");
      router.refresh();
    }
    setIsSaving(false);
  }

  async function deleteQuestion(question: PublicQuestion) {
    if (question.config.systemRole) {
      setError("Core form questions cannot be deleted. You can still edit their wording.");
      return;
    }
    if (!window.confirm(`Delete “${question.label.en || question.key}” from the draft? Existing submitted leads will not be affected.`)) return;
    const response = await fetch(`/api/admin/questions/${question.id}`, { method: "DELETE" });
    if (response.ok) {
      setQuestions((current) => current.filter((item) => item.id !== question.id));
      setNotice("Question deleted from the draft.");
      router.refresh();
    } else {
      const result = (await response.json()) as { message?: string };
      setError(result.message || "Could not delete the question.");
    }
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    if (
      questions[index].config.systemRole === "flow_selector" ||
      questions[target].config.systemRole === "flow_selector"
    ) {
      setError("The service-path selector must stay as the first question.");
      return;
    }
    if (
      questions[index].config.systemRole === "track_selector" ||
      questions[target].config.systemRole === "track_selector"
    ) {
      setError("A path-track selector must stay as the first question of its path.");
      return;
    }
    const reordered = [...questions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setQuestions(reordered);
    const response = await fetch("/api/admin/questions/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((question) => question.id) }),
    });
    if (!response.ok) {
      setQuestions(questions);
      setError("Could not save the new order.");
    } else router.refresh();
  }

  async function publish() {
    if (!window.confirm(`Publish version ${questionnaire.version}? The current live version will be archived, and a new editable draft will be created.`)) return;
    setIsPublishing(true);
    setError("");
    const response = await fetch("/api/admin/questionnaire/publish", { method: "POST" });
    const result = (await response.json()) as { ok?: boolean; message?: string; publishedVersion?: number };
    if (!response.ok || !result.ok) setError(result.message || "Could not publish the questionnaire.");
    else {
      setNotice(`Version ${result.publishedVersion} is now live.`);
      router.refresh();
    }
    setIsPublishing(false);
  }

  return (
    <>
      <div className="builder-toolbar">
        <div>
          <span className="draft-badge"><span /> DRAFT VERSION {questionnaire.version}</span>
          <p>Edits stay private until you publish. Old lead answers keep their original question text.</p>
        </div>
        <div>
          <a className="admin-button secondary" href="/contact" target="_blank" rel="noopener noreferrer"><Eye size={17} /> View published form</a>
          <button className="admin-button secondary" type="button" onClick={() => openEditor()}><Plus size={17} /> Add question</button>
          <button className="admin-button primary" type="button" onClick={publish} disabled={isPublishing || questions.length === 0}><Rocket size={17} /> {isPublishing ? "Publishing..." : "Publish changes"}</button>
        </div>
      </div>

      {notice && <div className="admin-notice success"><Check size={17} /> {notice}</div>}
      {error && !editing && <div className="admin-notice error">{error}</div>}

      <div className="builder-list">
        <div className="builder-list-head"><span>Order</span><span>Question</span><span>Type</span><span>Required</span><span>Actions</span></div>
        {questions.map((question, index) => (
          <article className={question.isActive ? "builder-row" : "builder-row inactive"} key={question.id}>
            <div className="builder-order">
              <GripVertical size={18} />
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <div>
                <button type="button" aria-label="Move question up" disabled={index === 0 || question.config.systemRole === "flow_selector" || questions[index - 1]?.config.systemRole === "flow_selector"} onClick={() => moveQuestion(index, -1)}><ArrowUp size={14} /></button>
                <button type="button" aria-label="Move question down" disabled={index === questions.length - 1 || question.config.systemRole === "flow_selector" || questions[index + 1]?.config.systemRole === "flow_selector"} onClick={() => moveQuestion(index, 1)}><ArrowDown size={14} /></button>
              </div>
            </div>
            <button className="builder-question" type="button" onClick={() => openEditor(question)}>
              <strong>{question.label.en || "Untitled question"}</strong>
              <small>{questionFlowLabel(question)} · {question.config.systemRole ? "Core question" : "Editable question"} · {question.key} · {question.label.hi ? "HI" : "No HI"} · {question.label.gu ? "GU" : "No GU"}</small>
            </button>
            <span className="question-type-pill">{typeLabels[question.type]}</span>
            <span className={question.required ? "required-yes" : "required-no"}>{question.required ? "Yes" : "No"}</span>
            <div className="builder-actions">
              <button type="button" aria-label="Edit question" onClick={() => openEditor(question)}><ChevronRight size={18} /></button>
              <button type="button" className="danger" aria-label="Delete question" disabled={Boolean(question.config.systemRole)} title={question.config.systemRole ? "Core form questions cannot be deleted" : undefined} onClick={() => deleteQuestion(question)}><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
        {questions.length === 0 && (
          <div className="builder-empty"><CopyPlus size={32} /><h3>No questions yet</h3><p>Add your first question to start building the lead form.</p><button className="admin-button primary" onClick={() => openEditor()}><Plus size={17} /> Add question</button></div>
        )}
      </div>

      {editing && (
        <div className="editor-backdrop" role="presentation">
          <section className="question-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <header>
              <div><span>{editing.id ? "EDIT QUESTION" : "NEW QUESTION"}</span><h2 id="editor-title">{editing.label.en || "Untitled question"}</h2></div>
              <button type="button" aria-label="Close editor" onClick={() => setEditing(null)}><X /></button>
            </header>
            <form onSubmit={saveQuestion}>
              <div className="editor-settings-grid">
                <label>Question key<input value={editing.key} disabled={editingIsSystemQuestion} title={editingIsSystemQuestion ? "The internal key is fixed for this core question" : undefined} onChange={(event) => setEditing({ ...editing, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} required pattern="[a-z0-9_]+" /></label>
                <label>Answer type<select value={editing.type} disabled={editingIsSystemQuestion} title={editingIsSystemQuestion ? "The answer type is fixed for this core question" : undefined} onChange={(event) => changeType(event.target.value as QuestionType)}>{questionTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
                <label>Form path<select value={editing.config.flow ?? "all"} disabled={editingIsSystemQuestion} title={editingIsSystemQuestion ? "Core questions are shared by every path" : undefined} onChange={(event) => changeFlow(event.target.value as "all" | GrowthPath)}><option value="all">All paths</option>{growthPaths.map((path) => <option key={path} value={path}>{growthPathLabels[path]} only</option>)}</select></label>
                <label>Path track<select value={editing.config.track ?? "all"} disabled={editingIsSystemQuestion || !editingPathHasTracks} title={editingIsSystemQuestion ? "Core questions are shared by every track" : editingPathHasTracks ? undefined : "This path does not branch further"} onChange={(event) => changeTrack(event.target.value as "all" | GrowthTrack)}><option value="all">All tracks</option>{growthTracks.map((track) => <option key={track} value={track}>{growthTrackLabels[track]} only</option>)}</select></label>
                <label className="editor-check"><input type="checkbox" checked={editing.required} disabled={editingIsSystemQuestion} onChange={(event) => setEditing({ ...editing, required: event.target.checked })} /><span><Check size={13} /></span> Required answer</label>
                <label className="editor-check"><input type="checkbox" checked={editing.isActive} disabled={editingIsSystemQuestion} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} /><span><Check size={13} /></span> Show on form</label>
              </div>

              <div className="editor-language-tabs" role="tablist" aria-label="Question language">
                {locales.map((locale) => <button type="button" key={locale} role="tab" aria-selected={editorLocale === locale} className={editorLocale === locale ? "active" : ""} onClick={() => setEditorLocale(locale)}>{languageNames[locale]} {locale === "en" && "*"}</button>)}
              </div>

              <div className="editor-copy-fields">
                <label>Question text <span>{languageNames[editorLocale]}</span><textarea rows={2} value={editing.label[editorLocale]} onChange={(event) => updateLocalized("label", event.target.value)} required={editorLocale === "en"} placeholder="Write the question in simple language" /></label>
                <label>Small help text <span>Optional</span><textarea rows={2} value={editing.helpText[editorLocale]} onChange={(event) => updateLocalized("helpText", event.target.value)} placeholder="A short explanation below the question" /></label>
                {!choiceTypes.has(editing.type) && !["yes_no", "rating"].includes(editing.type) && <label>Input placeholder <span>Optional</span><input value={editing.placeholder[editorLocale]} onChange={(event) => updateLocalized("placeholder", event.target.value)} placeholder="Example answer shown inside the field" /></label>}
              </div>

              {choiceTypes.has(editing.type) && (
                <div className="editor-options">
                  <div className="editor-section-title"><div><h3>Answer options</h3><p>{editingIsBranchSelector ? `Edit the ${languageNames[editorLocale]} wording. The branches themselves are fixed.` : `Edit the ${languageNames[editorLocale]} text for each choice.`}</p></div>{!editingIsBranchSelector && <button type="button" onClick={() => setEditing({ ...editing, options: [...editing.options, makeOption(editing.options.length + 1)] })}><Plus size={15} /> Add option</button>}</div>
                  {editing.options.map((option, index) => (
                    <div className="editor-option-row" key={option.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><input value={option.label[editorLocale]} onChange={(event) => updateOption(index, "label", event.target.value)} placeholder={`${languageNames[editorLocale]} option label`} required={editorLocale === "en"} /><input value={option.description?.[editorLocale] ?? ""} onChange={(event) => updateOption(index, "description", event.target.value)} placeholder="Small explanation (optional)" /></div>
                      <button type="button" aria-label="Remove option" disabled={editingIsBranchSelector || editing.options.length <= 2} title={editingIsBranchSelector ? "A branch option cannot be removed" : undefined} onClick={() => setEditing({ ...editing, options: editing.options.filter((_, optionIndex) => optionIndex !== index) })}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="editor-validation">
                {(["short_text", "long_text"].includes(editing.type)) && <label>Maximum characters<input type="number" min={1} max={5000} value={editing.config.maxLength ?? ""} onChange={(event) => setEditing({ ...editing, config: { ...editing.config, maxLength: event.target.value ? Number(event.target.value) : undefined } })} placeholder="Example: 500" /></label>}
                {editing.type === "multi_choice" && <label>Maximum selections<input type="number" min={1} max={Math.max(editing.options.length, 1)} value={editing.config.maxSelections ?? ""} onChange={(event) => setEditing({ ...editing, config: { ...editing.config, maxSelections: event.target.value ? Number(event.target.value) : undefined } })} placeholder="No limit" /></label>}
                {(["number", "rating"].includes(editing.type)) && <><label>Minimum<input type="number" value={editing.config.min ?? ""} onChange={(event) => setEditing({ ...editing, config: { ...editing.config, min: event.target.value ? Number(event.target.value) : undefined } })} /></label><label>Maximum<input type="number" value={editing.config.max ?? ""} onChange={(event) => setEditing({ ...editing, config: { ...editing.config, max: event.target.value ? Number(event.target.value) : undefined } })} /></label></>}
              </div>

              {error && <p className="admin-form-error" role="alert">{error}</p>}
              <footer><button type="button" className="admin-button secondary" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="admin-button primary" disabled={isSaving}>{isSaving ? "Saving..." : "Save to draft"} <Check size={17} /></button></footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
