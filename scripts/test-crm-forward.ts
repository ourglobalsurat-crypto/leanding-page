import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  buildCrmPayload,
  forwardLeadToCrm,
  landingPageUrl,
  readCrmConfig,
  type CrmLeadInput,
} from "../src/lib/crm-forward";
import type { PublicQuestion } from "../src/lib/types";

const link = "https://leadgen.example.com/website-form.php?form=ws_token.signature";

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
const answers: CrmLeadInput["answers"] = [
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
];

const lead: CrmLeadInput = {
  leadId,
  name: "Rajesh Patel",
  phone: "+919876543210",
  email: "rajesh@example.com",
  language: "gu",
  growthPath: "d2c_growth",
  pageUrl: "https://globalsurat.com/",
  utm: { source: "facebook", medium: "cpc", campaign: "diwali-2026", gclid: "abc123", content: "", term: "", fbclid: "" },
  answers,
  contactKeys: ["full_name", "phone", "email"],
};

// --- Configuration ----------------------------------------------------------
assert.equal(readCrmConfig(undefined), null, "An unset variable means forwarding is off, not broken");
assert.equal(readCrmConfig("   "), null);
const config = readCrmConfig(link)!;
assert.equal(config.endpoint, "https://leadgen.example.com/website-leads.php?form=ws_token.signature");
assert.equal(config.formToken, "ws_token.signature");
// A CRM served from a subpath must keep that subpath, as the connector does.
assert.equal(
  readCrmConfig("https://crm.example.com/leadgen/website-form.php?form=ws_a.b")!.endpoint,
  "https://crm.example.com/leadgen/website-leads.php?form=ws_a.b",
);
for (const bad of ["not-a-url", "http://leadgen.example.com/website-form.php?form=ws_a.b", "https://leadgen.example.com/website-form.php"]) {
  assert.throws(() => readCrmConfig(bad), /CRM_LEAD_FORM_URL/, `Expected ${bad} to be rejected`);
}

// --- Payload ----------------------------------------------------------------
const payload = buildCrmPayload(lead);
assert.equal(payload.name, "Rajesh Patel");
assert.equal(payload.phone, "+919876543210");
assert.equal(payload.email, "rajesh@example.com");
assert.equal(payload.request_id, leadId, "The lead id is what makes a CRM retry idempotent");
assert.equal(payload.company_website, "", "The honeypot must stay empty or the CRM discards the lead");
assert.equal(payload.page_url, "https://globalsurat.com/");
assert.equal(payload.gclid, "abc123");

const fields = payload.fields;
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
assert.ok(payload.message.startsWith("Website enquiry - D2C Growth path, submitted in Gujarati."));
assert.ok(payload.message.includes("Where do you advertise?: Google Ads, Meta Ads"));
assert.ok(payload.message.length <= 4000, "The CRM rejects a message over 4000 characters");
assert.deepEqual(
  Object.keys(buildCrmPayload({ ...lead, utm: {} }).fields).filter((key) => key === "Campaign"),
  [],
  "Empty attribution must not add blank fields",
);

// --- Page URL ---------------------------------------------------------------
const apiRequest = (referer?: string) =>
  new Request("https://globalsurat.com/api/leads", { method: "POST", headers: referer ? { referer } : {} });
assert.equal(landingPageUrl(apiRequest("https://globalsurat.com/?utm_source=facebook")), "https://globalsurat.com/");
assert.equal(landingPageUrl(apiRequest("https://globalsurat.com/contact")), "https://globalsurat.com/contact");
assert.equal(landingPageUrl(apiRequest("https://evil.example/hook")), "https://globalsurat.com/", "A cross-site Referer is ignored");
assert.equal(landingPageUrl(apiRequest()), "https://globalsurat.com/");
assert.equal(landingPageUrl(apiRequest(":::")), "https://globalsurat.com/");

// --- Forwarding -------------------------------------------------------------
type Call = { method: string; body: Record<string, unknown> | null };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

function stubFetch(responses: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), config.endpoint);
    assert.ok(init?.signal, "Every CRM request needs a timeout");
    assert.equal(init?.cache, "no-store", "A cached GET would replay a spent challenge");
    calls.push({
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra CRM request");
    return next();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const challenge = () => json({ ok: true, form: { challenge: `challenge-${Math.random()}` } });
const accepted = () => json({ ok: true, message: "Thank you!" });

async function main() {
  const waited: number[] = [];
  const wait = async (ms: number) => void waited.push(ms);

  const happy = stubFetch([challenge, accepted]);
  assert.deepEqual(await forwardLeadToCrm(lead, { config, fetchImpl: happy.impl, wait }), { status: "sent", attempts: 1 });
  assert.deepEqual(happy.calls.map((call) => call.method), ["GET", "POST"], "The challenge is fetched before the lead is posted");
  assert.equal(happy.calls[0].body, null);
  assert.match(String(happy.calls[1].body!.challenge), /^challenge-/, "The challenge must be threaded into the POST");
  assert.equal(happy.calls[1].body!.request_id, leadId);
  assert.deepEqual(waited, [], "A first-attempt success must not sleep");

  // A failed POST is retried with a fresh challenge and the same request id.
  const flaky = stubFetch([challenge, () => json({ ok: false, error: "temporary" }, 503), challenge, accepted]);
  assert.deepEqual(await forwardLeadToCrm(lead, { config, fetchImpl: flaky.impl, wait }), { status: "sent", attempts: 2 });
  assert.deepEqual(flaky.calls.map((call) => call.method), ["GET", "POST", "GET", "POST"]);
  assert.notEqual(flaky.calls[1].body!.challenge, flaky.calls[3].body!.challenge, "A retry must not replay a spent challenge");
  assert.equal(flaky.calls[3].body!.request_id, leadId, "A stable request id is what lets the CRM deduplicate");
  assert.deepEqual(waited, [1_000]);

  const offline = stubFetch(Array.from({ length: 3 }, () => () => { throw new Error("connect ECONNREFUSED"); }));
  await assert.rejects(forwardLeadToCrm(lead, { config, fetchImpl: offline.impl, wait }), /ECONNREFUSED/);
  assert.equal(offline.calls.length, 3, "Three attempts, then the caller is told");
  assert.deepEqual(waited, [1_000, 1_000, 4_000]);

  const unreached = stubFetch([]);
  assert.deepEqual(await forwardLeadToCrm(lead, { config: null, fetchImpl: unreached.impl, wait }), { status: "disabled" });
  const incomplete = await forwardLeadToCrm({ ...lead, phone: null }, { config, fetchImpl: unreached.impl, wait });
  assert.equal(incomplete.status, "skipped");
  assert.equal(unreached.calls.length, 0, "A lead the CRM would reject is never sent");

  console.log("PASS: endpoint derivation, https and token validation, contact slots, option labels, duplicate labels, truncation, page URL, challenge threading, retries, idempotent request id, disabled and skipped leads.");
}

main();
