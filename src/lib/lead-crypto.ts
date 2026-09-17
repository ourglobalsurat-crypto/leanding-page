import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";

import { normalizeIndianPhone } from "@/lib/validation";

// Deliberately no `import "server-only"` here, unlike its sibling files in
// this folder: this module also runs from scripts/test-lead-crypto.ts and
// scripts/migrate-encrypt-leads.ts via tsx, outside Next's bundler, where
// that marker throws unconditionally rather than only in a client bundle.
// It's safe to omit: the passphrase env vars it reads are not NEXT_PUBLIC_*,
// so Next never inlines their values into client JavaScript — an accidental
// client import would fail closed (readPassphrase throws "must be set") at
// runtime rather than leak a secret, just without the earlier build-time
// error the marker would otherwise give.

/**
 * Field-level encryption for lead phone numbers and email addresses.
 *
 * Two separate keys, each derived from its own passphrase, doing two
 * different jobs:
 *
 * - LEAD_ENCRYPTION_PASSPHRASE encrypts the field (AES-256-GCM) — this is
 *   what makes a stolen database backup unreadable.
 * - LEAD_INDEX_PASSPHRASE computes a one-way "blind index" (HMAC-SHA256) —
 *   a keyed hash stored alongside the ciphertext purely so the admin search
 *   box can still find an exact phone number or email address without ever
 *   decrypting anything to do it.
 *
 * The two are kept separate on purpose: leaking the index passphrase lets
 * someone test guesses against the blind index (confirm whether a specific
 * number is in your leads) but not decrypt a single row. Leaking the
 * encryption passphrase decrypts data but is useless for searching or
 * enumerating what's stored. A single shared key would let a leak of either
 * do both.
 *
 * This is NOT the "crack the first lock, see decoy data" scheme that was
 * originally asked for. That describes deniable encryption — one ciphertext
 * that decrypts to two different plausible plaintexts depending which key you
 * hold — which is a specialised, fragile construction, not something to
 * build from scratch for a lead-generation form. What's here is standard,
 * well-understood encryption with two keys doing two honestly different jobs.
 *
 * name and city are deliberately left unencrypted: the admin search box does
 * partial substring matching on them ("Raj" finds "Rajesh"), which a blind
 * index cannot do — it only supports exact matches. Encrypting phone/email
 * only preserves today's search for name and city, and narrows phone/email
 * search from "contains" to "exact match", which is disclosed in the README.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function readPassphrase(envVar: string): string {
  const value = process.env[envVar];
  if (!value || value.length < 8) {
    throw new Error(
      `${envVar} must be set (at least 8 characters) to store or read lead phone/email data.`,
    );
  }
  return value;
}

// scrypt is deliberately slow, so each key is derived once per process and
// reused rather than recomputed on every call.
let cachedEncryptionKey: Buffer | null = null;
let cachedIndexKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (!cachedEncryptionKey) {
    cachedEncryptionKey = scryptSync(
      readPassphrase("LEAD_ENCRYPTION_PASSPHRASE"),
      "global-surat-leads:encryption:v1",
      KEY_LENGTH,
    );
  }
  return cachedEncryptionKey;
}

function indexKey(): Buffer {
  if (!cachedIndexKey) {
    cachedIndexKey = scryptSync(
      readPassphrase("LEAD_INDEX_PASSPHRASE"),
      "global-surat-leads:index:v1",
      KEY_LENGTH,
    );
  }
  return cachedIndexKey;
}

/** Only used by tests, to observe a key change without restarting the process. */
export function _resetKeyCacheForTests(): void {
  cachedEncryptionKey = null;
  cachedIndexKey = null;
}

/**
 * Encrypts one field's value. `aad` should identify exactly what this
 * ciphertext is (lead id + column name) — it is authenticated but not
 * encrypted, and decryption fails if it does not match exactly, so a
 * ciphertext copied into a different row or column will not decrypt there.
 */
export function encryptField(plaintext: string, aad: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypts a value produced by {@link encryptField}. Throws if the ciphertext
 * is malformed, was encrypted under a different key, was tampered with, or
 * was encrypted with a different `aad` than the one passed here.
 */
export function decryptField(stored: string, aad: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unrecognized encrypted-field format.");
  }
  const [, ivPart, tagPart, ciphertextPart] = parts;

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** The additional authenticated data bound to one lead's encrypted field. */
export function fieldAad(leadId: string, column: "phone" | "email"): string {
  return `leads:${leadId}:${column}`;
}

/**
 * A one-way, keyed hash of a normalized value, stored alongside the
 * ciphertext so it can be looked up by an exact match without decrypting
 * anything. Two different values (almost) never produce the same hash, but
 * the hash cannot be reversed back to the value without LEAD_INDEX_PASSPHRASE
 * and, even then, only by guessing candidate values and hashing each one.
 */
export function blindIndex(normalizedValue: string): string {
  return createHmac("sha256", indexKey()).update(normalizedValue, "utf8").digest("hex");
}

export function normalizeEmailForIndex(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Reuses the same normalization applied at submission time so a search for
 * the same number, typed in a different format, still hashes to the stored
 * value. Returns null for input that isn't a recognizable phone number, so
 * the caller can skip the blind-index lookup rather than search for a hash
 * that will never match anything.
 */
export const normalizePhoneForIndex = normalizeIndianPhone;
