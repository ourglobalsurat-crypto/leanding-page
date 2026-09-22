export const locales = ["en", "hi", "gu"] as const;
export type Locale = (typeof locales)[number];

export type LocalizedText = Record<Locale, string>;

export const growthPaths = ["lead_generation", "d2c_growth", "seo"] as const;
export type GrowthPath = (typeof growthPaths)[number];

/** English names for the admin panel, the CRM mirror and validation messages. */
export const growthPathLabels: Record<GrowthPath, string> = {
  lead_generation: "Lead Generation",
  d2c_growth: "D2C Growth",
  seo: "SEO",
};

/**
 * A path can branch once more. SEO is planned around the same two business
 * models as the paid paths, so a visitor on the SEO path says whether they
 * want enquiries or online product sales before the questions narrow again.
 */
export const growthTracks = ["lead_generation", "d2c_growth"] as const;
export type GrowthTrack = (typeof growthTracks)[number];

export const growthTrackLabels: Record<GrowthTrack, string> = {
  lead_generation: "Lead Generation",
  d2c_growth: "D2C Growth",
};

export const systemQuestionRoles = [
  "flow_selector",
  "track_selector",
  "contact_name",
  "contact_phone",
] as const;
export type SystemQuestionRole = (typeof systemQuestionRoles)[number];

export const questionTypes = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "single_choice",
  "multi_choice",
  "dropdown",
  "yes_no",
  "date",
  "rating",
] as const;

export type QuestionType = (typeof questionTypes)[number];

export type QuestionOption = {
  id: string;
  label: LocalizedText;
  description?: LocalizedText;
};

export type QuestionConfig = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  minSelections?: number;
  maxSelections?: number;
  allowOther?: boolean;
  /** Questions without a flow are shared by every questionnaire path. */
  flow?: GrowthPath;
  /** Narrows a question to one track of its flow. Requires a flow. */
  track?: GrowthTrack;
  /** Stable internal meaning for questions whose copy remains admin-editable. */
  systemRole?: SystemQuestionRole;
};

export type PublicQuestion = {
  id: string;
  key: string;
  type: QuestionType;
  label: LocalizedText;
  helpText: LocalizedText;
  placeholder: LocalizedText;
  required: boolean;
  position: number;
  options: QuestionOption[];
  config: QuestionConfig;
  isActive: boolean;
};

export type PublicQuestionnaire = {
  formId: string;
  versionId: string;
  slug: string;
  name: string;
  version: number;
  questions: PublicQuestion[];
  isFallback?: boolean;
};

export const leadStatuses = [
  "new",
  "contacted",
  "qualified",
  "won",
  "not_interested",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];

export type LeadListItem = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  language: Locale;
  status: LeadStatus;
  source: string | null;
  createdAt: string;
};

export type LeadAnswer = {
  id: string;
  questionKey: string;
  answer: unknown;
  questionSnapshot: {
    type: QuestionType;
    label: LocalizedText;
    options: QuestionOption[];
  };
};

export type LeadNote = {
  id: string;
  note: string;
  createdAt: string;
  adminEmail: string;
};

export type LeadDetail = LeadListItem & {
  referrer: string | null;
  utm: Record<string, string>;
  consentAt: string;
  answers: LeadAnswer[];
  notes: LeadNote[];
};
