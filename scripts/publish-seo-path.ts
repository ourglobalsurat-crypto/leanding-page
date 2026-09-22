import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

import { defaultQuestions } from "../src/lib/default-questionnaire";
import { validateQuestionnaireFlow } from "../src/lib/questionnaire-flow";
import type {
  PublicQuestion,
  QuestionConfig,
  QuestionOption,
  QuestionType,
} from "../src/lib/types";

/**
 * Adds the SEO path to an already-published questionnaire.
 *
 * Unlike scripts/publish-branching-questionnaire.ts, which replaced the whole
 * form with the defaults, this works from the current editable draft: the SEO
 * selector option and the SEO questions are appended to whatever the admins
 * have edited, so their wording changes survive the publish. The shared
 * contact questions are pushed back to the end so the SEO branch sits before
 * the name and WhatsApp-number steps, exactly as the other two paths do.
 *
 * The SEO branch carries its own selector, because SEO is planned around the
 * same Lead Generation and D2C business models the paid paths cover. Those
 * questions are appended in their default order, which puts that selector
 * first inside the path, as the flow rules require.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });

// Resolved on first use, not at import time, so scripts/test-seo-path.ts can
// import planSeoPublish() without any database variables being present.
let sqlClient: ReturnType<typeof neon> | null = null;

function sql() {
  if (!sqlClient) {
    const connectionString =
      process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL?.replace("-pooler.", ".");
    if (!connectionString) {
      throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is missing from .env.local");
    }
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}

const seoQuestions = defaultQuestions.filter((question) => question.config.flow === "seo");
const defaultSeoOption = defaultQuestions
  .find((question) => question.config.systemRole === "flow_selector")
  ?.options.find((option) => option.id === "seo");

if (seoQuestions.length === 0 || !defaultSeoOption) {
  throw new Error("The default questionnaire no longer describes an SEO path.");
}

const seoSelectorOption: QuestionOption = defaultSeoOption;

type FormRow = {
  form_id: string;
  draft_version_id: string;
  draft_version_number: number;
  published_version_id: string | null;
};

type QuestionRow = {
  id: string;
  question_key: string;
  question_type: QuestionType;
  label: PublicQuestion["label"];
  help_text: PublicQuestion["helpText"];
  placeholder: PublicQuestion["placeholder"];
  required: boolean;
  position: number;
  options: QuestionOption[];
  config: QuestionConfig;
  is_active: boolean;
};

function rowToQuestion(row: QuestionRow): PublicQuestion {
  return {
    id: row.id,
    key: row.question_key,
    type: row.question_type,
    label: row.label,
    helpText: row.help_text,
    placeholder: row.placeholder,
    required: row.required,
    position: row.position,
    options: row.options ?? [],
    config: row.config ?? {},
    isActive: row.is_active,
  };
}

function insertQuestion(versionId: string, question: PublicQuestion, position: number) {
  return sql().query(
    `INSERT INTO questions (
      id, version_id, question_key, question_type, label, help_text,
      placeholder, required, position, options, config, is_active
    ) VALUES (
      $1, $2, $3, $4, $5::jsonb, $6::jsonb,
      $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12
    )`,
    [
      crypto.randomUUID(),
      versionId,
      question.key,
      question.type,
      JSON.stringify(question.label),
      JSON.stringify(question.helpText),
      JSON.stringify(question.placeholder),
      question.required,
      position,
      JSON.stringify(question.options),
      JSON.stringify(question.config),
      question.isActive,
    ],
  );
}

export type SeoPublishPlan = {
  selector: PublicQuestion;
  selectorNeedsOption: boolean;
  selectorOptions: QuestionOption[];
  missingSeoQuestions: PublicQuestion[];
  /** Every draft question, renumbered, with the SEO branch merged in. */
  ordered: PublicQuestion[];
};

/**
 * Works out what the draft needs, or returns null when it already has the SEO
 * path. Throws when the result would not be a submittable questionnaire, so a
 * broken draft is caught before anything is written.
 */
export function planSeoPublish(draftQuestions: PublicQuestion[]): SeoPublishPlan | null {
  const selector = draftQuestions.find(
    (question) => question.config.systemRole === "flow_selector",
  );
  if (!selector) {
    throw new Error(
      "The draft has no service-path selector. Run npm run db:publish-branching-form first.",
    );
  }

  const existingKeys = new Set(draftQuestions.map((question) => question.key));
  const missingSeoQuestions = seoQuestions.filter((question) => !existingKeys.has(question.key));
  const selectorNeedsOption = !selector.options.some((option) => option.id === "seo");
  if (missingSeoQuestions.length === 0 && !selectorNeedsOption) return null;

  const selectorOptions = selectorNeedsOption
    ? [...selector.options, seoSelectorOption]
    : selector.options;

  // Shared contact questions always close the form, so the SEO branch is
  // appended between the existing path questions and them.
  const isContactQuestion = (question: PublicQuestion) =>
    question.config.systemRole === "contact_name" || question.config.systemRole === "contact_phone";

  const ordered: PublicQuestion[] = [
    ...draftQuestions.filter((question) => !isContactQuestion(question)),
    ...missingSeoQuestions,
    ...draftQuestions.filter((question) => isContactQuestion(question)),
  ].map((question, index) => ({
    ...question,
    position: index + 1,
    options: question.id === selector.id ? selectorOptions : question.options,
  }));

  const flowIssue = validateQuestionnaireFlow(ordered);
  if (flowIssue) throw new Error(`The resulting questionnaire would be invalid: ${flowIssue}`);

  return { selector, selectorNeedsOption, selectorOptions, missingSeoQuestions, ordered };
}

async function main() {
  const rows = (await sql().query(
    `SELECT f.id AS form_id, f.current_published_version_id AS published_version_id,
            fv.id AS draft_version_id, fv.version_number AS draft_version_number
     FROM forms f
     JOIN form_versions fv ON fv.form_id = f.id AND fv.status = 'draft'
     WHERE f.slug = 'growth-check'
     ORDER BY fv.version_number DESC
     LIMIT 1`,
  )) as FormRow[];

  const form = rows[0];
  if (!form) {
    throw new Error(
      "The growth-check form has no editable draft. Run npm run db:publish-branching-form first.",
    );
  }

  if (form.published_version_id) {
    const published = (await sql().query(
      `SELECT 1
       FROM questions
       WHERE version_id = $1 AND question_key = $2 AND is_active = true
       LIMIT 1`,
      [form.published_version_id, "seo_track"],
    )) as Array<Record<string, number>>;

    if (published[0]) {
      console.log("The SEO path is already published. No database changes were made.");
      return;
    }
  }

  const draftRows = (await sql().query(
    `SELECT id, question_key, question_type, label, help_text, placeholder,
            required, position, options, config, is_active
     FROM questions
     WHERE version_id = $1
     ORDER BY position ASC, created_at ASC`,
    [form.draft_version_id],
  )) as QuestionRow[];

  const plan = planSeoPublish(draftRows.map(rowToQuestion));
  if (!plan) {
    console.log("The draft already carries the SEO path. Publish it from the admin panel instead.");
    return;
  }

  const { selector, selectorNeedsOption, selectorOptions, missingSeoQuestions, ordered } = plan;
  const nextDraftVersionId = crypto.randomUUID();
  const nextDraftVersionNumber = Number(form.draft_version_number) + 1;
  const insertedIds = new Set(missingSeoQuestions.map((question) => question.id));

  const queries = [
    ...(selectorNeedsOption
      ? [
          sql().query(`UPDATE questions SET options = $1::jsonb, updated_at = now() WHERE id = $2`, [
            JSON.stringify(selectorOptions),
            selector.id,
          ]),
        ]
      : []),
    ...ordered
      .filter((question) => !insertedIds.has(question.id))
      .map((question) =>
        sql().query(`UPDATE questions SET position = $1, updated_at = now() WHERE id = $2`, [
          question.position,
          question.id,
        ]),
      ),
    ...ordered
      .filter((question) => insertedIds.has(question.id))
      .map((question) => insertQuestion(form.draft_version_id, question, question.position)),
    sql().query(
      `UPDATE form_versions
       SET status = 'archived', updated_at = now()
       WHERE form_id = $1 AND status = 'published'`,
      [form.form_id],
    ),
    sql().query(
      `UPDATE form_versions
       SET status = 'published', published_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'draft'`,
      [form.draft_version_id],
    ),
    sql().query(
      `UPDATE forms
       SET current_published_version_id = $1, updated_at = now()
       WHERE id = $2`,
      [form.draft_version_id, form.form_id],
    ),
    sql().query(
      `INSERT INTO form_versions (id, form_id, version_number, status)
       VALUES ($1, $2, $3, 'draft')`,
      [nextDraftVersionId, form.form_id, nextDraftVersionNumber],
    ),
    sql().query(
      `INSERT INTO questions (
        id, version_id, question_key, question_type, label, help_text,
        placeholder, required, position, options, config, is_active
      )
      SELECT gen_random_uuid(), $1, question_key, question_type, label, help_text,
             placeholder, required, position, options, config, is_active
      FROM questions
      WHERE version_id = $2
      ORDER BY position`,
      [nextDraftVersionId, form.draft_version_id],
    ),
    sql().query(
      `INSERT INTO audit_log (action, entity_type, entity_id, metadata)
       VALUES ('questionnaire.seo_path_published', 'form_version', $1, $2::jsonb)`,
      [
        form.draft_version_id,
        JSON.stringify({
          publishedVersion: Number(form.draft_version_number),
          draftVersion: nextDraftVersionNumber,
          addedQuestionKeys: missingSeoQuestions.map((question) => question.key),
          addedSelectorOption: selectorNeedsOption,
        }),
      ],
    ),
  ];

  await sql().transaction(queries);

  console.log(
    `Published version ${form.draft_version_number} with the SEO path (${missingSeoQuestions.length} new question(s)).`,
  );
  console.log(`Created editable draft version ${nextDraftVersionNumber}.`);
  console.log("Existing admin wording, leads, and archived versions were left untouched.");
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((error) => {
    console.error("SEO path publish failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
