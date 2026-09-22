import { config } from "dotenv";

import { readCrmConfig } from "../src/lib/crm-forward";

// Read-only connection check for the Leadgen CRM. It fetches the form's
// configuration exactly as src/lib/crm-forward.ts does before a send, and
// stops there: nothing is ever posted, so this never creates a CRM record.
//
// This checks the environment it runs in. Run it locally and it reads
// .env.local; to check production, read the deployed logs instead - a lead
// submitted with no CRM_LEAD_FORM_URL logs "CRM forwarding is OFF".

config({ path: ".env.local", quiet: true });

async function main() {
  let crm;
  try {
    crm = readCrmConfig();
  } catch (error) {
    console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  if (!crm) {
    console.log("OFF   CRM_LEAD_FORM_URL is not set, so leads are stored locally and forwarded nowhere.");
    console.log("      Paste the CRM's connection link into .env.local, and into the hosting environment.");
    return;
  }

  // The token is a credential, so only its shape is printed, never its value.
  console.log(`OK    Configured. Token ${crm.formToken.slice(0, 6)}… (${crm.formToken.length} chars)`);
  console.log(`      Endpoint ${crm.endpoint.split("?")[0]}`);

  try {
    const response = await fetch(crm.endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      error?: string;
      form?: { title?: string; challenge?: string };
    };

    if (!response.ok || !result.ok) {
      console.error(`FAIL  The CRM rejected this token: ${result.error || `HTTP ${response.status}`}`);
      process.exitCode = 1;
      return;
    }

    console.log(`OK    Reachable. The CRM calls this form "${result.form?.title ?? "untitled"}".`);
    console.log(`OK    Challenge issued, so a lead submitted now would be accepted.`);
    console.log("      No lead was sent; this check never posts.");
  } catch (error) {
    console.error(`FAIL  Could not reach the CRM: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
