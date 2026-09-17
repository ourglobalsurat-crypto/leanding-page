/**
 * Checks the CSV export's decoy gate. Run with `npm run test:export-unlock`.
 *
 * The property that matters most here is negative: nothing except the exact
 * real passphrase may ever produce real data, and no wrong entry may be
 * distinguishable from the decoy passphrase.
 */

process.env.LEAD_EXPORT_REAL_PASSPHRASE = "real-passphrase-for-tests";
process.env.LEAD_EXPORT_DECOY_PASSPHRASE = "decoy-passphrase-for-tests";

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

async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}
       ${error instanceof Error ? error.message : error}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

async function main() {
  const { resolveExportMode, shouldEchoContent, filePasswordFor } = await import("../src/lib/export-unlock");
  const { toEncryptedXlsx } = await import("../src/lib/encrypted-workbook");
  const officeCrypto = (await import("officecrypto-tool")).default;
  const { buildDecoyLeads } = await import("../src/lib/decoy-leads");

  check("the real passphrase unlocks real data", () => {
    assertEqual(resolveExportMode("real-passphrase-for-tests"), "real", "real passphrase did not unlock");
  });

  check("the decoy passphrase returns decoy data", () => {
    assertEqual(resolveExportMode("decoy-passphrase-for-tests"), "decoy", "decoy passphrase did not return decoy");
  });

  check("a wrong entry returns decoy data", () => {
    assertEqual(resolveExportMode("hello there"), "decoy", "a wrong entry must not return real data");
  });

  check("an empty entry returns decoy data", () => {
    assertEqual(resolveExportMode(""), "decoy", "an empty entry must not return real data");
  });

  check("a near-miss of the real passphrase returns decoy data", () => {
    assertEqual(resolveExportMode("real-passphrase-for-test"), "decoy", "a truncated passphrase must not unlock");
    assertEqual(resolveExportMode("Real-Passphrase-For-Tests"), "decoy", "wrong case must not unlock");
    assertEqual(resolveExportMode(" real-passphrase-for-tests"), "decoy", "leading whitespace must not unlock");
  });

  check("an unset real passphrase cannot be matched by an empty entry", () => {
    const saved = process.env.LEAD_EXPORT_REAL_PASSPHRASE;
    delete process.env.LEAD_EXPORT_REAL_PASSPHRASE;
    try {
      assertEqual(resolveExportMode(""), "decoy", "an unset passphrase must never unlock");
      assertEqual(resolveExportMode("undefined"), "decoy", "an unset passphrase must never unlock");
    } finally {
      process.env.LEAD_EXPORT_REAL_PASSPHRASE = saved;
    }
  });

  check("neither passphrase is echoed into the exported file", () => {
    assertEqual(shouldEchoContent("real-passphrase-for-tests"), false, "the real passphrase must not be written to the file");
    assertEqual(shouldEchoContent("decoy-passphrase-for-tests"), false, "the decoy passphrase must not be written to the file");
  });

  check("ordinary content is echoed into the exported file", () => {
    assertEqual(shouldEchoContent("Q3 handover notes"), true, "ordinary content should be written to the file");
    assertEqual(shouldEchoContent("   "), false, "blank content should not add an empty row");
  });

  check("decoy rows are stable across runs", () => {
    assertEqual(
      JSON.stringify(buildDecoyLeads(5)),
      JSON.stringify(buildDecoyLeads(5)),
      "two decoy runs differed, which would reveal the rows are generated",
    );
  });

  check("decoy row count matches what was asked for", () => {
    assertEqual(buildDecoyLeads(0).length, 0, "zero leads should produce zero rows");
    assertEqual(buildDecoyLeads(4).length, 4, "wrong row count");
    assertEqual(buildDecoyLeads(37).length, 37, "wrong row count");
  });

  check("decoy rows are distinct from each other", () => {
    const leads = buildDecoyLeads(25);
    const phones = new Set(leads.map((lead) => lead.phone));
    const ids = new Set(leads.map((lead) => lead.id));
    if (ids.size !== leads.length) throw new Error("decoy lead ids repeated");
    if (phones.size < leads.length - 2) throw new Error("decoy phone numbers repeated too often to look real");
  });

  check("decoy rows look like plausible lead records", () => {
    for (const lead of buildDecoyLeads(30)) {
      if (!/^\+91[6-9]\d{9}$/.test(lead.phone)) throw new Error(`implausible phone number: ${lead.phone}`);
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(lead.email)) throw new Error(`implausible email: ${lead.email}`);
      if (!/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(lead.name)) throw new Error(`implausible name: ${lead.name}`);
      if (Number.isNaN(Date.parse(lead.createdAt))) throw new Error(`invalid date: ${lead.createdAt}`);
    }
  });

  check("decoy timestamps run newest-first, like the real export", () => {
    const leads = buildDecoyLeads(12);
    for (let i = 1; i < leads.length; i += 1) {
      if (Date.parse(leads[i].createdAt) >= Date.parse(leads[i - 1].createdAt)) {
        throw new Error("decoy rows are not in descending date order");
      }
    }
  });

  check("the file password is always what was typed, so the file always opens", () => {
    assertEqual(filePasswordFor("real-passphrase-for-tests"), "real-passphrase-for-tests", "real passphrase should lock its own file");
    assertEqual(filePasswordFor("hello there"), "hello there", "a wrong entry must still open the file it produced");
    assertEqual(filePasswordFor(""), "decoy-passphrase-for-tests", "an empty entry should fall back to the decoy passphrase");
    assertEqual(filePasswordFor("   "), "decoy-passphrase-for-tests", "a blank entry should fall back to the decoy passphrase");
  });

  await checkAsync("the exported workbook is genuinely encrypted, not a plain zip", async () => {
    const buf = await toEncryptedXlsx([["Name", "Phone"], ["Rajesh Patel", "+919876543210"]], "first-key");
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (!buf.subarray(0, 8).equals(ole)) throw new Error("output is not an encrypted Office container");
    if (buf.subarray(0, 2).toString() === "PK") throw new Error("output is a plain unencrypted zip");
    if (!officeCrypto.isEncrypted(buf)) throw new Error("officecrypto does not consider the file encrypted");
  });

  await checkAsync("the right password opens it and a wrong one does not", async () => {
    const buf = await toEncryptedXlsx([["Name"], ["Rajesh Patel"]], "first-key");
    const opened = await officeCrypto.decrypt(buf, { password: "first-key" });
    if (opened.subarray(0, 2).toString() !== "PK") throw new Error("the right password did not yield a workbook");
    let rejected = false;
    try {
      await officeCrypto.decrypt(buf, { password: "not-the-password" });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("a wrong password opened the file");
  });

  await checkAsync("a locked workbook never leaks its contents in the clear", async () => {
    const buf = await toEncryptedXlsx([["Phone"], ["+919876543210"]], "first-key");
    if (buf.includes(Buffer.from("+919876543210", "utf8"))) {
      throw new Error("the phone number is readable inside the encrypted file");
    }
  });

  if (failed) {
    console.error(`\n${failed} export-unlock check(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll export-unlock checks passed.");
}

main();

// Marks this file as a module so its top-level names stay local to it
// rather than colliding with the other standalone test scripts.
export {};
