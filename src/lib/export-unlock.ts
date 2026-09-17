import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Decides whether a CSV export returns real lead data or invented decoy rows.
 *
 * The admin panel's export dialog shows a single field labelled "Add content".
 * For anyone who does not know better it behaves exactly as labelled: whatever
 * they type is written into the exported file, and a file downloads. What it
 * also does is decide which data that file contains:
 *
 *   LEAD_EXPORT_REAL_PASSPHRASE   -> the real, decrypted leads
 *   LEAD_EXPORT_DECOY_PASSPHRASE  -> invented rows
 *   anything else, including empty -> invented rows
 *
 * There is deliberately no error, no "wrong passphrase", no difference in
 * status code, and no difference in how long the request takes. A wrong entry
 * is indistinguishable from the decoy passphrase, which is the entire point:
 * someone who forces their way in gets a plausible file and no signal that a
 * better answer exists.
 *
 * This check is server-side on purpose. Doing it in the browser would let
 * anyone skip the dialog and request the export URL directly.
 */

export type ExportMode = "real" | "decoy";

/**
 * Compares in constant time. Both sides are hashed first so that the
 * comparison length never depends on the secret, which would otherwise leak
 * the passphrase's length through timing.
 */
function matches(candidate: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Both passphrases are always compared, even once the first one matches, so
 * the work done is identical whatever the visitor typed.
 */
export function resolveExportMode(entered: string): ExportMode {
  const isReal = matches(entered, process.env.LEAD_EXPORT_REAL_PASSPHRASE);
  const isDecoy = matches(entered, process.env.LEAD_EXPORT_DECOY_PASSPHRASE);
  return isReal && !isDecoy ? "real" : "decoy";
}

/**
 * Whether the text the visitor typed should be written into the exported file
 * as the "content" the field promises. A recognised passphrase is swallowed
 * instead — writing it into a downloadable file would put it somewhere it does
 * not belong.
 */
export function shouldEchoContent(entered: string): boolean {
  if (!entered.trim()) return false;
  return (
    !matches(entered, process.env.LEAD_EXPORT_REAL_PASSPHRASE) &&
    !matches(entered, process.env.LEAD_EXPORT_DECOY_PASSPHRASE)
  );
}

/**
 * The password the exported workbook is locked with.
 *
 * Always whatever the person typed, so the file they get always opens with the
 * words they just used — a wrong entry still produces a working file, full of
 * invented rows. Locking a wrong entry's file with something else would make
 * it refuse to open, and "this file won't open" is itself the error message
 * this whole design is built to avoid.
 *
 * An empty entry — the plain Export button, or a direct request to the URL —
 * falls back to the decoy passphrase, so that file opens with the first key.
 */
export function filePasswordFor(entered: string): string {
  if (entered.trim()) return entered;
  return process.env.LEAD_EXPORT_DECOY_PASSPHRASE ?? "locked";
}
