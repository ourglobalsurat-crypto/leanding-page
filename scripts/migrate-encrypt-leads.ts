/**
 * One-time migration for a database created before lead encryption existed:
 * adds the encrypted columns, backfills them from the existing plaintext
 * `phone`/`email` columns, and leaves those plaintext columns in place.
 *
 * A brand-new database does not need this - `npm run db:setup` already
 * creates the encrypted columns from the start (see scripts/setup-db.ts).
 *
 * Safe to run more than once: every step uses IF NOT EXISTS / IF EXISTS, and
 * the backfill only touches rows that don't have encrypted data yet, so
 * re-running after fixing a config problem picks up where it left off.
 *
 * Deliberately does NOT drop the old `phone`/`email` columns - do that
 * yourself, manually, only after confirming the admin panel shows the right
 * phone number and email for a few real leads. See the README for the exact
 * statement and why it's not automated here.
 *
 * Usage:
 *   npx tsx scripts/migrate-encrypt-leads.ts            (dry run - no writes)
 *   npx tsx scripts/migrate-encrypt-leads.ts --apply     (writes for real)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

import {
  blindIndex,
  encryptField,
  fieldAad,
  normalizeEmailForIndex,
  normalizePhoneForIndex,
} from "../src/lib/lead-crypto";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });

const apply = process.argv.includes("--apply");

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL?.replace("-pooler.", ".");
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is missing from .env.local");
}
if (!process.env.LEAD_ENCRYPTION_PASSPHRASE || !process.env.LEAD_INDEX_PASSPHRASE) {
  throw new Error(
    "LEAD_ENCRYPTION_PASSPHRASE and LEAD_INDEX_PASSPHRASE must be set in .env.local before migrating.",
  );
}

const sql = neon(connectionString);

type PlainLeadRow = { id: string; phone: string | null; email: string | null };

async function ensureColumns() {
  await sql.query(`
    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS phone_enc text,
      ADD COLUMN IF NOT EXISTS phone_bidx text,
      ADD COLUMN IF NOT EXISTS email_enc text,
      ADD COLUMN IF NOT EXISTS email_bidx text
  `);
  await sql.query(`CREATE INDEX IF NOT EXISTS leads_phone_bidx_idx ON leads(phone_bidx)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS leads_email_bidx_idx ON leads(email_bidx)`);
}

async function columnExists(column: string): Promise<boolean> {
  const rows = (await sql.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = $1`,
    [column],
  )) as unknown[];
  return rows.length > 0;
}

async function main() {
  console.log(
    apply
      ? "Running for real (--apply set).\n"
      : "Dry run - no writes will be made. Re-run with --apply to migrate.\n",
  );

  const hasPlainPhone = await columnExists("phone");
  const hasPlainEmail = await columnExists("email");
  if (!hasPlainPhone && !hasPlainEmail) {
    console.log(
      "No plaintext phone/email columns found - this database is already on the encrypted schema, or was created fresh. Nothing to do.",
    );
    return;
  }

  if (apply) await ensureColumns();

  // In a dry run against a database that has never been migrated, phone_enc /
  // email_enc don't exist yet - that's not an error, it just means every row
  // with a plaintext value still needs migrating.
  const hasEncPhone = await columnExists("phone_enc");
  const hasEncEmail = await columnExists("email_enc");

  // "Needs migrating" means there IS a plaintext value and it has NOT been
  // encrypted yet - not merely "the encrypted column is null", which is also
  // true, correctly, for a lead that never had a phone/email in the first
  // place. Conflating the two would make every field-less row look pending
  // forever.
  const whereParts: string[] = [];
  if (hasPlainPhone) {
    whereParts.push(hasEncPhone ? "(phone IS NOT NULL AND phone_enc IS NULL)" : "phone IS NOT NULL");
  }
  if (hasPlainEmail) {
    whereParts.push(hasEncEmail ? "(email IS NOT NULL AND email_enc IS NULL)" : "email IS NOT NULL");
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(" OR ")}` : "";

  const rows = (await sql.query(
    `SELECT id, ${hasPlainPhone ? "phone" : "NULL AS phone"}, ${hasPlainEmail ? "email" : "NULL AS email"}
     FROM leads
     ${where}`,
  )) as PlainLeadRow[];

  console.log(`${rows.length} lead row(s) need encrypted columns backfilled.`);
  if (!rows.length) return;

  let migrated = 0;

  for (const row of rows) {
    if (!row.phone && !row.email) continue;

    const phoneEnc = row.phone ? encryptField(row.phone, fieldAad(row.id, "phone")) : null;
    const phoneBidx = row.phone ? blindIndex(normalizePhoneForIndex(row.phone) ?? row.phone) : null;
    const emailEnc = row.email ? encryptField(row.email, fieldAad(row.id, "email")) : null;
    const emailBidx = row.email ? blindIndex(normalizeEmailForIndex(row.email)) : null;

    if (apply) {
      await sql.query(
        `UPDATE leads
         SET phone_enc = $1, phone_bidx = $2, email_enc = $3, email_bidx = $4
         WHERE id = $5`,
        [phoneEnc, phoneBidx, emailEnc, emailBidx, row.id],
      );
    }
    migrated += 1;
  }

  console.log(`${apply ? "Encrypted" : "Would encrypt"} ${migrated} row(s).`);

  if (!apply) {
    console.log("\nThis was a dry run. Re-run with --apply to write the encrypted columns.");
    return;
  }

  console.log(
    "\nDone. Next: open the admin panel and check that a few real leads show the right phone " +
      "number and email. Once you're confident, drop the old plaintext columns yourself with:\n" +
      "  ALTER TABLE leads DROP COLUMN phone, DROP COLUMN email;\n" +
      "That statement is not run automatically - see the README.",
  );
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
