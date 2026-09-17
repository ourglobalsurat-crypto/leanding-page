import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import { defaultQuestions } from "../src/lib/default-questionnaire";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local") });

// Schema operations should use Neon's direct endpoint when one is available.
// The application itself continues to use the pooled DATABASE_URL.
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL?.replace("-pooler.", ".");
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is missing from .env.local");
}
if (!adminEmail || !adminPassword) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env.local");
}

const sql = neon(connectionString);

const FORM_ID = "11111111-1111-4111-8111-111111111111";
const PUBLISHED_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const DRAFT_VERSION_ID = "33333333-3333-4333-8333-333333333333";

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE TABLE IF NOT EXISTS admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'editor', 'viewer')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    current_published_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS form_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(form_id, version_number)
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
    question_key text NOT NULL,
    question_type text NOT NULL,
    label jsonb NOT NULL DEFAULT '{}'::jsonb,
    help_text jsonb NOT NULL DEFAULT '{}'::jsonb,
    placeholder jsonb NOT NULL DEFAULT '{}'::jsonb,
    required boolean NOT NULL DEFAULT false,
    position integer NOT NULL DEFAULT 0,
    options jsonb NOT NULL DEFAULT '[]'::jsonb,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(version_id, question_key)
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY,
    form_id uuid NOT NULL REFERENCES forms(id),
    form_version_id uuid NOT NULL REFERENCES form_versions(id),
    language text NOT NULL CHECK (language IN ('en', 'hi', 'gu')),
    name text,
    -- Phone and email are stored only as AES-256-GCM ciphertext, plus a
    -- blind index (a keyed hash) that lets the admin search box find an
    -- exact match without ever decrypting anything. See src/lib/lead-crypto.ts.
    phone_enc text,
    phone_bidx text,
    email_enc text,
    email_bidx text,
    city text,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'not_interested')),
    source text,
    referrer text,
    utm jsonb NOT NULL DEFAULT '{}'::jsonb,
    consent_at timestamptz NOT NULL,
    submission_token uuid NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lead_answers (
    id uuid PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
    question_key text NOT NULL,
    answer jsonb NOT NULL,
    question_snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS lead_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    admin_id uuid NOT NULL REFERENCES admin_users(id),
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS leads_phone_bidx_idx ON leads(phone_bidx)`,
  `CREATE INDEX IF NOT EXISTS leads_email_bidx_idx ON leads(email_bidx)`,
  `CREATE INDEX IF NOT EXISTS questions_version_position_idx ON questions(version_id, position)`,
  `CREATE INDEX IF NOT EXISTS lead_answers_lead_idx ON lead_answers(lead_id)`,
];

async function seedQuestions(versionId: string) {
  const countRows = (await sql.query(
    `SELECT count(*)::int AS count FROM questions WHERE version_id = $1`,
    [versionId],
  )) as { count: number }[];

  if (Number(countRows[0]?.count ?? 0) > 0) return;

  for (const question of defaultQuestions) {
    await sql.query(
      `INSERT INTO questions (
        id, version_id, question_key, question_type, label, help_text,
        placeholder, required, position, options, config, is_active
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb,
        $7::jsonb, $8, $9, $10::jsonb, $11::jsonb, true
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
        question.position,
        JSON.stringify(question.options),
        JSON.stringify(question.config),
      ],
    );
  }
}

async function main() {
  for (const statement of statements) await sql.query(statement);

  const passwordHash = await bcrypt.hash(adminPassword!, 12);
  await sql.query(
    `INSERT INTO admin_users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'owner', true)
     ON CONFLICT (email) DO UPDATE
     SET password_hash = excluded.password_hash,
         is_active = true,
         updated_at = now()`,
    [adminEmail!.toLowerCase(), passwordHash],
  );

  await sql.query(
    `INSERT INTO forms (id, slug, name, current_published_version_id)
     VALUES ($1, 'growth-check', 'Global Surat Growth Check', $2)
     ON CONFLICT (slug) DO NOTHING`,
    [FORM_ID, PUBLISHED_VERSION_ID],
  );

  await sql.query(
    `INSERT INTO form_versions (id, form_id, version_number, status, published_at)
     VALUES ($1, $2, 1, 'published', now())
     ON CONFLICT (form_id, version_number) DO NOTHING`,
    [PUBLISHED_VERSION_ID, FORM_ID],
  );

  await sql.query(
    `INSERT INTO form_versions (id, form_id, version_number, status)
     VALUES ($1, $2, 2, 'draft')
     ON CONFLICT (form_id, version_number) DO NOTHING`,
    [DRAFT_VERSION_ID, FORM_ID],
  );

  await sql.query(
    `UPDATE forms
     SET current_published_version_id = $1, updated_at = now()
     WHERE id = $2 AND current_published_version_id IS NULL`,
    [PUBLISHED_VERSION_ID, FORM_ID],
  );

  await seedQuestions(PUBLISHED_VERSION_ID);
  await seedQuestions(DRAFT_VERSION_ID);

  console.log("Neon database is ready.");
  console.log(`Admin account: ${adminEmail}`);
  console.log(`Seeded ${defaultQuestions.length} editable questions in English, Hindi and Gujarati.`);
}

main().catch((error) => {
  console.error("Database setup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
