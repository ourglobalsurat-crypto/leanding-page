/**
 * Checks lead field encryption and the blind search index.
 * Run with `npm run test:lead-crypto`.
 *
 * Worth keeping green: a mistake here either corrupts real customer phone
 * numbers/emails beyond recovery, or quietly makes them decryptable/
 * searchable by the wrong key.
 */

process.env.LEAD_ENCRYPTION_PASSPHRASE = "test-encryption-passphrase-1";
process.env.LEAD_INDEX_PASSPHRASE = "test-index-passphrase-1";

let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}\n       ${error instanceof Error ? error.message : error}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

function assertThrows(fn: () => void, message: string) {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

async function main() {
const {
  encryptField,
  decryptField,
  fieldAad,
  blindIndex,
  normalizeEmailForIndex,
  normalizePhoneForIndex,
  _resetKeyCacheForTests,
} = await import("../src/lib/lead-crypto");

check("round trip returns the original plaintext", () => {
  const aad = fieldAad("lead-1", "phone");
  const encrypted = encryptField("+919876543210", aad);
  assertEqual(decryptField(encrypted, aad), "+919876543210", "decrypted value did not match");
});

check("round trip preserves unicode (a Gujarati name)", () => {
  const aad = fieldAad("lead-1", "phone");
  const encrypted = encryptField("રાજેશ પટેલ", aad);
  assertEqual(decryptField(encrypted, aad), "રાજેશ પટેલ", "unicode was not preserved");
});

check("the same plaintext encrypts differently each time", () => {
  const aad = fieldAad("lead-1", "phone");
  const a = encryptField("+919876543210", aad);
  const b = encryptField("+919876543210", aad);
  if (a === b) throw new Error("ciphertext was identical across two calls (IV is not random)");
});

check("decrypting under the wrong lead id fails", () => {
  const encrypted = encryptField("+919876543210", fieldAad("lead-1", "phone"));
  assertThrows(
    () => decryptField(encrypted, fieldAad("lead-2", "phone")),
    "decrypting under a different lead's AAD should have thrown",
  );
});

check("decrypting under the wrong column fails", () => {
  const encrypted = encryptField("+919876543210", fieldAad("lead-1", "phone"));
  assertThrows(
    () => decryptField(encrypted, fieldAad("lead-1", "email")),
    "decrypting a phone ciphertext as an email should have thrown",
  );
});

check("a flipped ciphertext byte is detected", () => {
  const encrypted = encryptField("+919876543210", fieldAad("lead-1", "phone"));
  const parts = encrypted.split(".");
  const tampered = Buffer.from(parts[3], "base64url");
  tampered[0] ^= 0xff;
  parts[3] = tampered.toString("base64url");
  assertThrows(
    () => decryptField(parts.join("."), fieldAad("lead-1", "phone")),
    "a tampered ciphertext should fail authentication",
  );
});

check("decrypting under a different encryption passphrase fails", () => {
  const encrypted = encryptField("+919876543210", fieldAad("lead-1", "phone"));
  process.env.LEAD_ENCRYPTION_PASSPHRASE = "a-completely-different-passphrase";
  _resetKeyCacheForTests();
  try {
    assertThrows(
      () => decryptField(encrypted, fieldAad("lead-1", "phone")),
      "decrypting under a different key should have thrown",
    );
  } finally {
    process.env.LEAD_ENCRYPTION_PASSPHRASE = "test-encryption-passphrase-1";
    _resetKeyCacheForTests();
  }
});

check("blind index is deterministic for the same input", () => {
  assertEqual(blindIndex("+919876543210"), blindIndex("+919876543210"), "same input hashed differently");
});

check("blind index differs for different input", () => {
  if (blindIndex("+919876543210") === blindIndex("+919876543211")) {
    throw new Error("two different phone numbers hashed to the same value");
  }
});

check("blind index differs under a different index passphrase", () => {
  const original = blindIndex("+919876543210");
  process.env.LEAD_INDEX_PASSPHRASE = "a-completely-different-passphrase";
  _resetKeyCacheForTests();
  try {
    if (blindIndex("+919876543210") === original) {
      throw new Error("blind index did not change when the index passphrase changed");
    }
  } finally {
    process.env.LEAD_INDEX_PASSPHRASE = "test-index-passphrase-1";
    _resetKeyCacheForTests();
  }
});

check("email normalization is case- and whitespace-insensitive", () => {
  assertEqual(
    blindIndex(normalizeEmailForIndex("  John@Example.com  ")),
    blindIndex(normalizeEmailForIndex("john@example.com")),
    "differently-cased/whitespaced email did not normalize to the same index",
  );
});

check("phone normalization matches submission-time normalization", () => {
  assertEqual(normalizePhoneForIndex("9876543210"), "+919876543210", "bare 10-digit number did not normalize");
  assertEqual(normalizePhoneForIndex("+91 98765 43210"), "+919876543210", "spaced +91 number did not normalize");
  assertEqual(normalizePhoneForIndex("91-9876543210"), "+919876543210", "91-prefixed number did not normalize");
});

check("an unrecognizable search term does not normalize to a phone", () => {
  assertEqual(normalizePhoneForIndex("not a phone number"), null, "garbage input should not normalize");
});

check("an unrecognized ciphertext format is rejected", () => {
  assertThrows(
    () => decryptField("not-the-right-format", fieldAad("lead-1", "phone")),
    "a malformed stored value should have thrown, not decrypted to garbage",
  );
});

if (failed) {
  console.error(`\n${failed} lead-crypto check(s) failed.`);
  process.exit(1);
}

console.log("\nAll lead-crypto checks passed.");
}

main();

// Marks this file as a module so its top-level names stay local to it
// rather than colliding with the other standalone test scripts.
export {};
