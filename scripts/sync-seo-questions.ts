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
 * Makes the SEO section of the live questionnaire match
 * src/lib/default-questionnaire.ts, then publishes it.
 *
 * Questions on the Lead Generation and D2C Growth paths, the shared contact
 * questions and the service-path selector are never touched, including any
 * wording an admin has edited. Only questions on the SEO path are replaced:
 * ones whose key is gone are removed from the draft, ones that remain are
 * rewritten, and new ones are inserted.
 *
 * Removal happens in the draft only. The published version is archived by the
 * publish, not deleted, so leads that answered the old SEO questions keep both
 * their answers and the question rows those answers point at.
 *
 * Run with --apply to write. Without it, it prints what it would change.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });

const apply = process.argv.includes("--apply");

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
if (seoQuestions.length === 0) throw new Error("The default questionnaire has no SEO questions.");

type FormRow = {
  form_id: string;
  draft_version_id: string;
  draft_version_number: number;
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

export type SeoSyncPlan = {
  removed: PublicQuestion[];
  rewritten: PublicQuestion[];
  added: PublicQuestion[];
  /** The whole draft, renumbered, with the SEO section replaced. */
  ordered: PublicQuestion[];
};

/**
 * Works out the replacement, or returns null when the draft already matches.
 * Throws when the result would not be a submittable questionnaire.
 */
export function planSeoSync(draftQuestions: readonly PublicQuestion[]): SeoSyncPlan | null {
  const isSeo = (question: PublicQuestion) => question.config.flow === "seo";
  const wanted = new Map(seoQuestions.map((question) => [question.key, question]));
  const existingSeo = draftQuestions.filter(isSeo);
  const existingByKey = new Map(existingSeo.map((question) => [question.key, question]));

  const removed = existingSeo.filter((question) => !wanted.has(question.key));
  const rewritten: PublicQuestion[] = [];
  const added: PublicQuestion[] = [];

  // Each wanted question keeps the database row it already had, so a question
  // that only changed wording does not lose its id.
  const replacement = seoQuestions.map((question) => {
    const existing = existingByKey.get(question.key);
    const next = existing ? { ...question, id: existing.id } : question;
    (existing ? rewritten : added).push(next);
    return next;
  });

  const unchanged =
    removed.length === 0 &&
    added.length === 0 &&
    rewritten.every((question) => {
      const existing = existingByKey.get(question.key);
      if (!existing) return false;
      return (
        JSON.stringify([
          existing.label,
          existing.helpText,
          existing.placeholder,
          existing.options,
          existing.config,
          existing.type,
          existing.required,
          existing.isActive,
        ]) ===
        JSON.stringify([
          question.label,
          question.helpText,
          question.placeholder,
          question.options,
          question.config,
          question.type,
          question.required,
          question.isActive,
        ])
      );
    });
  if (unchanged) return null;

  // The SEO section sits where it already sat: after the other paths, before
  // the shared contact questions.
  const isContact = (question: PublicQuestion) =>
    question.config.systemRole === "contact_name" || question.config.systemRole === "contact_phone";

  const ordered = [
    ...draftQuestions.filter((question) => !isSeo(question) && !isContact(question)),
    ...replacement,
    ...draftQuestions.filter(isContact),
  ].map((question, index) => ({ ...question, position: index + 1 }));

  const issue = validateQuestionnaireFlow(ordered);
  if (issue) throw new Error(`The resulting questionnaire would be invalid: ${issue}`);

  return { removed, rewritten, added, ordered };
}

function writeQuestion(versionId: string, question: PublicQuestion, insert: boolean) {
  const values = [
    question.key,
    question.type,
    JSON.stringify(question.label),
    JSON.stringify(question.helpText),
    JSON.stringify(question.placeholder),
    question.required,
    question.position,
    JSON.stringify(question.options),
    JSON.stringify(question.config),
    question.isActive,
  ];

  if (insert) {
    return sql().query(
      `INSERT INTO questions (
        id, version_id, question_key, question_type, label, help_text,
        placeholder, required, position, options, config, is_active
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, $12
      )`,
      [crypto.randomUUID(), versionId, ...values],
    );
  }

  return sql().query(
    `UPDATE questions
     SET question_key = $1, question_type = $2, label = $3::jsonb, help_text = $4::jsonb,
         placeholder = $5::jsonb, required = $6, position = $7, options = $8::jsonb,
         config = $9::jsonb, is_active = $10, updated_at = now()
     WHERE id = $11`,
    [...values, question.id],
  );
}

async function main() {
  const rows = (await sql().query(
    `SELECT f.id AS form_id, fv.id AS draft_version_id, fv.version_number AS draft_version_number
     FROM forms f
     JOIN form_versions fv ON fv.form_id = f.id AND fv.status = 'draft'
     WHERE f.slug = 'growth-check'
     ORDER BY fv.version_number DESC
     LIMIT 1`,
  )) as FormRow[];

  const form = rows[0];
  if (!form) throw new Error("The growth-check form has no editable draft.");

  const draftRows = (await sql().query(
    `SELECT id, question_key, question_type, label, help_text, placeholder,
            required, position, options, config, is_active
     FROM questions WHERE version_id = $1 ORDER BY position ASC, created_at ASC`,
    [form.draft_version_id],
  )) as QuestionRow[];

  const plan = planSeoSync(draftRows.map(rowToQuestion));
  if (!plan) {
    console.log("The SEO section already matches the default questionnaire. Nothing to do.");
    return;
  }

  for (const question of plan.removed) console.log(`  remove   ${question.key}`);
  for (const question of plan.rewritten) console.log(`  rewrite  ${question.key}`);
  for (const question of plan.added) console.log(`  add      ${question.key}`);
  console.log(
    `\n${plan.removed.length} removed, ${plan.rewritten.length} rewritten, ${plan.added.length} added.`,
  );

  if (!apply) {
    console.log("Dry run. No writes were made. Re-run with --apply to publish this.");
    return;
  }

  const nextDraftVersionId = crypto.randomUUID();
  const nextDraftVersionNumber = Number(form.draft_version_number) + 1;

  await sql().transaction([
    ...plan.removed.map((question) =>
      sql().query(`DELETE FROM questions WHERE id = $1`, [question.id]),
    ),
    ...plan.ordered.map((question) =>
      writeQuestion(
        form.draft_version_id,
        question,
        plan.added.some((added) => added.id === question.id),
      ),
    ),
    sql().query(
      `UPDATE form_versions SET status = 'archived', updated_at = now()
       WHERE form_id = $1 AND status = 'published'`,
      [form.form_id],
    ),
    sql().query(
      `UPDATE form_versions SET status = 'published', published_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'draft'`,
      [form.draft_version_id],
    ),
    sql().query(
      `UPDATE forms SET current_published_version_id = $1, updated_at = now() WHERE id = $2`,
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
      FROM questions WHERE version_id = $2 ORDER BY position`,
      [nextDraftVersionId, form.draft_version_id],
    ),
    sql().query(
      `INSERT INTO audit_log (action, entity_type, entity_id, metadata)
       VALUES ('questionnaire.seo_questions_synced', 'form_version', $1, $2::jsonb)`,
      [
        form.draft_version_id,
        JSON.stringify({
          publishedVersion: Number(form.draft_version_number),
          draftVersion: nextDraftVersionNumber,
          removed: plan.removed.map((question) => question.key),
          added: plan.added.map((question) => question.key),
          rewritten: plan.rewritten.map((question) => question.key),
        }),
      ],
    ),
  ]);

  console.log(`\nPublished version ${form.draft_version_number} with the new SEO section.`);
  console.log(`Created editable draft version ${nextDraftVersionNumber}.`);
  console.log("Other paths, archived versions and submitted leads were untouched.");
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((error) => {
    console.error("SEO question sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
