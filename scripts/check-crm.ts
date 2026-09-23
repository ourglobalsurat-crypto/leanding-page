import { config } from "dotenv";

import { crmFormLink, crmSiteOrigin, getCrmClient } from "../src/lib/crm-lead";

// Read-only connection check for the Leadgen CRM. It validates the form link
// through the vendor connector and fetches the form's configuration, then
// stops: nothing is ever posted, so this cannot create a CRM record.
//
// It checks the environment it runs in, which locally means .env.local. To
// check a deployed site, submit a lead there and read the host's logs.

config({ path: ".env.local", quiet: true });

async function main() {
  const link = crmFormLink();
  const origin = crmSiteOrigin();
  const source = process.env.CRM_LEAD_FORM_URL?.trim() ? "CRM_LEAD_FORM_URL" : "the built-in default";

  try {
    // Throws unless the link is a complete Leadgen website-form.php link.
    getCrmClient(link);
  } catch (error) {
    console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
    console.error(`      The link came from ${source}.`);
    process.exitCode = 1;
    return;
  }

  // The token is a public write-only form key, but there is no reason to print
  // all of it, so only its shape is shown.
  const token = new URL(link).searchParams.get("form") ?? "";
  console.log(`OK    Link accepted by the connector (from ${source}).`);
  console.log(`      Token ${token.slice(0, 6)}… (${token.length} chars)`);
  console.log(`      Site origin ${origin}`);

  const endpoint = new URL("website-leads.php", link);
  endpoint.searchParams.set("form", token);

  try {
    const response = await fetch(endpoint, {
      // The connector sends this on a server, and the CRM expects it.
      headers: { Accept: "application/json", Origin: origin },
      signal: AbortSignal.timeout(20_000),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      error?: string;
      form?: { title?: string; challenge?: string };
    };

    if (!response.ok || result.ok !== true) {
      console.error(`FAIL  The CRM rejected this request: ${result.error || `HTTP ${response.status}`}`);
      process.exitCode = 1;
      return;
    }

    console.log(`OK    Reachable. The CRM calls this form "${result.form?.title ?? "untitled"}".`);
    console.log("OK    Challenge issued, so a lead submitted now would be accepted.");
    console.log("      No lead was sent; this check never posts.");
  } catch (error) {
    console.error(`FAIL  Could not reach the CRM: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
