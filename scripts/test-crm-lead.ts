import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  buildCrmLead,
  crmFormLink,
  crmPageUrl,
  crmSiteOrigin,
  getCrmClient,
  sendLeadToCrm,
  type CrmLeadInput,
} from "../src/lib/crm-lead";
import { createLeadClient, type LeadClient, type LeadClientOptions, type LeadClientLead } from "../src/lib/lead-client.mjs";
import type { PublicQuestion } from "../src/lib/types";

function question(overrides: Partial<PublicQuestion> & { key: string }): PublicQuestion {
  return {
    id: randomUUID(),
    type: "short_text",
    label: { en: overrides.key, hi: "", gu: "" },
    helpText: { en: "", hi: "", gu: "" },
    placeholder: { en: "", hi: "", gu: "" },
    required: true,
    position: 0,
    options: [],
    config: {},
    isActive: true,
    ...overrides,
  };
}

const leadId = randomUUID();
const origin = "https://global-surat.vercel.app";

const lead: CrmLeadInput = {
  leadId,
  name: "Rajesh Patel",
  phone: "+919876543210",
  email: "rajesh@example.com",
  language: "gu",
  growthPath: "d2c_growth",
  origin,
  pageUrl: `${origin}/contact`,
  utm: { source: "facebook", medium: "cpc", campaign: "diwali-2026", gclid: "abc123" },
  answers: [
    { question: question({ key: "full_name", label: { en: "Your name", hi: "", gu: "" }, config: { systemRole: "contact_name" } }), value: "Rajesh Patel" },
    { question: question({ key: "phone", label: { en: "Mobile number", hi: "", gu: "" }, config: { systemRole: "contact_phone" } }), value: "+919876543210" },
    { question: question({ key: "email", label: { en: "Email", hi: "", gu: "" } }), value: "rajesh@example.com" },
    { question: question({ key: "city", label: { en: "City", hi: "", gu: "" } }), value: "Surat" },
    {
      question: question({
        key: "channels",
        type: "multi_choice",
        label: { en: "Where do you advertise?", hi: "", gu: "" },
        options: [
          { id: "google_ads", label: { en: "Google Ads", hi: "", gu: "" } },
          { id: "meta_ads", label: { en: "Meta Ads", hi: "", gu: "" } },
        ],
      }),
      value: ["google_ads", "meta_ads"],
    },
    // Deliberately shares the English label of the city question above.
    { question: question({ key: "branch_city", label: { en: "City", hi: "", gu: "" } }), value: "Vadodara" },
    { question: question({ key: "notes", label: { en: "", hi: "", gu: "" } }), value: "x".repeat(1500) },
  ],
  contactKeys: ["full_name", "phone", "email"],
};

// --- Configuration ----------------------------------------------------------
// The link must be usable by the vendor connector, which validates it strictly.
assert.doesNotThrow(() => createLeadClient(crmFormLink()), "The built-in form link must satisfy the connector");
assert.equal(new URL(crmSiteOrigin()).origin, crmSiteOrigin(), "The site origin must be a bare origin");
assert.equal(getCrmClient(crmFormLink()), getCrmClient(crmFormLink()), "The client is reused, keeping its dedupe state");
for (const bad of ["not-a-url", "https://leadgen.globalsurat.com/website-form.php", "https://leadgen.globalsurat.com/other.php?form=ws_fc8f2951c5750b8d.dc883585c654bc773a787b33ead18c4c30b66fcebafd64ca"]) {
  assert.throws(() => createLeadClient(bad), `Expected the connector to reject ${bad}`);
}
// The lead id is the requestId, so it must satisfy the connector's own rule.
assert.match(leadId, /^[a-zA-Z0-9-]{20,80}$/, "A lead UUID must be a valid requestId");

// --- Payload ----------------------------------------------------------------
const payload = buildCrmLead(lead);
assert.equal(payload.name, "Rajesh Patel");
assert.equal(payload.phone, "+919876543210");
assert.equal(payload.email, "rajesh@example.com");
assert.equal(payload.company_website, "", "The honeypot must stay empty or the CRM discards the lead");
assert.equal(payload.gclid, "abc123");

const fields = payload.fields!;
for (const consumed of ["Your name", "Mobile number", "Email"]) {
  assert.ok(!(consumed in fields), `${consumed} already has a dedicated CRM slot`);
}
assert.equal(fields["Where do you advertise?"], "Google Ads, Meta Ads", "Option ids must render as their labels");
assert.equal(fields["City"], "Surat");
assert.equal(fields["City (2)"], "Vadodara", "A duplicate label must not overwrite the earlier answer");
assert.equal(fields["notes"], "x".repeat(999) + "…", "A long answer is truncated, not dropped");
assert.equal(fields["Service path"], "D2C Growth");
assert.equal(fields["Language"], "Gujarati");
assert.equal(fields["Campaign"], "diwali-2026");
assert.equal(fields["Ad source"], "facebook");
assert.equal(fields["Lead ID"], leadId);
assert.ok(payload.message!.startsWith("Website enquiry - D2C Growth path, submitted in Gujarati."));
assert.ok(payload.message!.includes("Where do you advertise?: Google Ads, Meta Ads"));
assert.ok(payload.message!.length <= 4000, "The CRM rejects a message over 4000 characters");
assert.ok(
  !Object.keys(buildCrmLead({ ...lead, utm: {} }).fields!).includes("Campaign"),
  "Empty attribution must not add blank fields",
);

// --- Page URL ---------------------------------------------------------------
const apiRequest = (referer?: string) =>
  new Request("https://global-surat.vercel.app/api/leads", { method: "POST", headers: referer ? { referer } : {} });
assert.equal(crmPageUrl(apiRequest(`${origin}/?utm_source=facebook`), origin), `${origin}/`);
assert.equal(crmPageUrl(apiRequest(`${origin}/contact`), origin), `${origin}/contact`);
assert.equal(crmPageUrl(apiRequest("https://evil.example/hook"), origin), `${origin}/`, "A cross-site Referer is ignored");
assert.equal(crmPageUrl(apiRequest(), origin), `${origin}/`);
assert.equal(crmPageUrl(apiRequest(":::"), origin), `${origin}/`);
// Whatever the request host, the page URL must belong to the configured origin,
// because the connector rejects any other.
assert.ok(crmPageUrl(apiRequest(`${origin}/contact`), origin).startsWith(origin));

// --- Sending ----------------------------------------------------------------
type Call = { lead: LeadClientLead; options?: LeadClientOptions };

function stubClient(outcomes: Array<"ok" | Error>) {
  const calls: Call[] = [];
  const client: LeadClient = {
    async submit(submitted, options) {
      calls.push({ lead: submitted, options });
      const next = outcomes.shift();
      if (!next) throw new Error("Unexpected extra CRM submission");
      if (next !== "ok") throw next;
      return { ok: true as const, message: "Thank you!" };
    },
  };
  return { client, calls };
}

async function main() {
  const waited: number[] = [];
  const wait = async (ms: number) => void waited.push(ms);

  const happy = stubClient(["ok"]);
  assert.deepEqual(await sendLeadToCrm(lead, { client: happy.client, wait }), { status: "sent", attempts: 1 });
  assert.equal(happy.calls.length, 1);
  assert.equal(happy.calls[0].options?.requestId, leadId, "The lead id is what makes a retry idempotent");
  assert.equal(happy.calls[0].options?.origin, origin, "The connector requires the site origin on a server");
  assert.equal(happy.calls[0].options?.pageUrl, `${origin}/contact`);
  assert.deepEqual(waited, [], "A first-attempt success must not sleep");

  const flaky = stubClient([new Error("CRM receipt could not be confirmed."), "ok"]);
  assert.deepEqual(await sendLeadToCrm(lead, { client: flaky.client, wait }), { status: "sent", attempts: 2 });
  assert.equal(
    flaky.calls[0].options?.requestId,
    flaky.calls[1].options?.requestId,
    "A retry must reuse the request id so the CRM deduplicates",
  );
  assert.deepEqual(flaky.calls[0].lead, flaky.calls[1].lead, "A retry must resend the identical lead");
  assert.deepEqual(waited, [1_000]);

  const offline = stubClient([new Error("boom"), new Error("boom"), new Error("boom")]);
  await assert.rejects(sendLeadToCrm(lead, { client: offline.client, wait }), /boom/);
  assert.equal(offline.calls.length, 3, "Three attempts, then the caller is told");
  assert.deepEqual(waited, [1_000, 1_000, 4_000]);

  const unreached = stubClient([]);
  const incomplete = await sendLeadToCrm({ ...lead, phone: null }, { client: unreached.client, wait });
  assert.equal(incomplete.status, "skipped");
  assert.equal(unreached.calls.length, 0, "A lead the connector would reject is never sent");

  console.log("PASS: link validation, site origin, contact slots, option labels, duplicate labels, truncation, page URL pinning, stable request id across retries, give-up behaviour, skipped leads.");
}

main();
