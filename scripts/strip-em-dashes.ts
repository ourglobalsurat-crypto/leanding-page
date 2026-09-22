import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

import type { LocalizedText, QuestionOption } from "../src/lib/types";

/**
 * Removes every em dash from the question text already stored in the database.
 *
 * The questions a visitor sees come from Postgres, not from
 * src/lib/default-questionnaire.ts, so cleaning the source file alone leaves
 * the live form unchanged. This rewrites the text in place, the same way
 * scripts/publish-language-update.ts merges translations: no new version, no
 * change to any question's key, type, path, track, order or answer options'
 * ids, and no effect on leads that were already submitted.
 *
 * Only the published and draft versions are touched. Archived versions keep
 * their original wording, which is what the lead answer snapshots refer to.
 *
 * Run with --apply to write. Without it, it prints what it would change.
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL?.replace("-pooler.", ".");
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is missing from .env.local");
}

const sql = neon(connectionString);
const apply = process.argv.includes("--apply");

const EM_DASH = "—";

/** Matches the punctuation chosen for the same strings in the source file. */
function clean(value: string): string {
  if (!value.includes(EM_DASH)) return value;

  // "Lead Generation - for service, local and B2B businesses" reads as a name
  // followed by who it is for, so those subtitles take a colon.
  let next = value.replace(
    new RegExp(`^(Lead Generation|D2C Growth|D2C|SEO) ${EM_DASH} `),
    "$1: ",
  );
  next = next.split(` ${EM_DASH} `).join(", ");
  next = next.split(EM_DASH).join(", ");
  return next;
}

function cleanLocalized(value: LocalizedText | null): LocalizedText | null {
  if (!value) return value;
  return { en: clean(value.en ?? ""), hi: clean(value.hi ?? ""), gu: clean(value.gu ?? "") };
}

function cleanOptions(options: QuestionOption[] | null): QuestionOption[] {
  return (options ?? []).map((option) => ({
    ...option,
    label: cleanLocalized(option.label) ?? option.label,
    description: option.description ? cleanLocalized(option.description) ?? option.description : option.description,
  }));
}

type QuestionRow = {
  id: string;
  question_key: string;
  version_number: number;
  status: string;
  label: LocalizedText;
  help_text: LocalizedText;
  placeholder: LocalizedText;
  options: QuestionOption[];
};

function hasEmDash(row: QuestionRow) {
  return JSON.stringify([row.label, row.help_text, row.placeholder, row.options]).includes(
    EM_DASH,
  );
}

async function main() {
  const rows = (await sql.query(
    `SELECT q.id, q.question_key, fv.version_number, fv.status,
            q.label, q.help_text, q.placeholder, q.options
     FROM questions q
     JOIN form_versions fv ON fv.id = q.version_id
     JOIN forms f ON f.id = fv.form_id
     WHERE f.slug = 'growth-check' AND fv.status IN ('published', 'draft')
     ORDER BY fv.version_number, q.position`,
  )) as QuestionRow[];

  const affected = rows.filter(hasEmDash);
  if (affected.length === 0) {
    console.log("No em dashes found in the published or draft questions.");
    return;
  }

  for (const row of affected) {
    console.log(`  ${row.status} v${row.version_number}  ${row.question_key}`);
  }
  console.log(`\n${affected.length} question(s) contain an em dash.`);

  if (!apply) {
    console.log("Dry run. No writes were made. Re-run with --apply to clean them.");
    return;
  }

  await sql.transaction(
    affected.map((row) =>
      sql.query(
        `UPDATE questions
         SET label = $1::jsonb, help_text = $2::jsonb, placeholder = $3::jsonb,
             options = $4::jsonb, updated_at = now()
         WHERE id = $5`,
        [
          JSON.stringify(cleanLocalized(row.label)),
          JSON.stringify(cleanLocalized(row.help_text)),
          JSON.stringify(cleanLocalized(row.placeholder)),
          JSON.stringify(cleanOptions(row.options)),
          row.id,
        ],
      ),
    ),
  );

  console.log(`\nCleaned ${affected.length} question(s). Archived versions and leads were untouched.`);
}

main().catch((error) => {
  console.error("Em dash cleanup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
