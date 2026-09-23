import { createLeadClient, type LeadClient, type LeadClientLead } from "./lead-client.mjs";

import { growthPathLabels, type GrowthPath, type Locale, type PublicQuestion } from "@/lib/types";

// Deliberately no `import "server-only"` here, for the same reason as
// src/lib/lead-crypto.ts: scripts/ imports this module via tsx, outside Next's
// bundler, where that marker throws unconditionally.

/**
 * Sends every stored lead to the Leadgen CRM through the vendor's own
 * connector, src/lib/lead-client.mjs, downloaded from the CRM unmodified.
 *
 * The connector owns the wire protocol: it validates the form link, takes a
 * single-use challenge, posts the enquiry, and -- the part that matters for a
 * server integration -- sets the `Origin` header the CRM expects, which a
 * browser would otherwise set by itself.
 *
 * It deliberately does not retry. Retrying is this module's job, reusing one
 * stable requestId so the CRM deduplicates instead of storing the lead twice.
 *
 * The CRM is a mirror, never the system of record: the lead is already in
 * Postgres before any of this runs, and failures are reported to the caller
 * rather than shown to the visitor.
 */

// The Leadgen connection link. This token is a public, write-only form key --
// the CRM's browser connector puts the identical value in page HTML -- so it
// is not a secret and lives in source, where no missing environment variable
// can silently switch lead forwarding off. CRM_LEAD_FORM_URL overrides it, so
// rotating the link in Leadgen Settings > Website Leads needs no code change.
const DEFAULT_FORM_LINK =
  "https://leadgen.globalsurat.com/website-form.php?form=ws_fc8f2951c5750b8d.dc883585c654bc773a787b33ead18c4c30b66fcebafd64ca";

// The site origin registered with the CRM. The connector requires it on a
// server and rejects a pageUrl belonging to any other origin.
const DEFAULT_SITE_ORIGIN = "https://global-surat.vercel.app";

const RETRY_DELAYS_MS = [1_000, 4_000];

// The CRM rejects an entire submission that exceeds one of these, so a long
// answer is truncated rather than allowed to lose the whole lead.
const LIMITS = { name: 120, phone: 35, email: 254, message: 4_000, field: 1_000 };

const languageNames: Record<Locale, string> = { en: "English", hi: "Hindi", gu: "Gujarati" };

// growthPathLabels is the shared source for these names, so a path added to
// src/lib/types.ts reaches the CRM without being renamed here.
const pathName = (path: GrowthPath | "general") =>
  path === "general" ? "General" : growthPathLabels[path];

export type CrmLeadInput = {
  leadId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  language: Locale;
  growthPath: GrowthPath | "general";
  pageUrl: string;
  origin: string;
  utm: Record<string, string>;
  answers: ReadonlyArray<{ question: PublicQuestion; value: unknown }>;
  /** Question keys already carried by the dedicated name/phone/email slots. */
  contactKeys?: readonly string[];
};

export type CrmSendResult =
  | { status: "sent"; attempts: number }
  | { status: "skipped"; reason: string };

export function crmFormLink() {
  return process.env.CRM_LEAD_FORM_URL?.trim() || DEFAULT_FORM_LINK;
}

export function crmSiteOrigin() {
  return process.env.CRM_SITE_ORIGIN?.trim() || DEFAULT_SITE_ORIGIN;
}

// createLeadClient validates the link, so build it once and reuse it. The
// connector also keeps in-flight deduplication state on the instance.
let cached: { link: string; client: LeadClient } | null = null;
export function getCrmClient(link = crmFormLink()) {
  if (!cached || cached.link !== link) cached = { link, client: createLeadClient(link) };
  return cached.client;
}

/**
 * The page the visitor submitted from, pinned to the configured origin. The
 * connector rejects a pageUrl from any other origin, so only the path is
 * taken from the request.
 */
export function crmPageUrl(request: Request, origin = crmSiteOrigin()) {
  try {
    // Parsed with no base on purpose: a Referer is always absolute, so a
    // relative or malformed one is junk that must not reach the CRM.
    const referer = new URL(request.headers.get("referer") ?? "");
    // A cross-site Referer must not decide what we report either.
    if (referer.origin === new URL(request.url).origin) return `${origin}${referer.pathname}`;
  } catch {
    // No Referer, or an unparseable one; fall through to the site root.
  }
  return `${origin}/`;
}

function clamp(value: string, max: number) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Renders one stored answer the way the lead desk renders it, so the CRM
 * shows "Google Ads" rather than the option id `google_ads`.
 */
function renderAnswer(question: PublicQuestion, value: unknown) {
  const resolve = (item: unknown) =>
    question.options.find((option) => option.id === item)?.label.en ?? String(item ?? "");
  return Array.isArray(value)
    ? value.map(resolve).filter(Boolean).join(", ")
    : resolve(value);
}

/** Every answer the visitor gave, plus attribution, as the CRM's per-field map. */
function buildFields(input: CrmLeadInput) {
  const fields: Record<string, string> = {};
  const skip = new Set(input.contactKeys ?? []);

  const add = (label: string, value: string) => {
    const text = clamp(value, LIMITS.field);
    if (!text) return;
    // Two questions can share one English label. The CRM keys on the label, so
    // the later answer would otherwise overwrite the earlier one unnoticed.
    let key = label;
    for (let suffix = 2; key in fields; suffix += 1) key = `${label} (${suffix})`;
    fields[key] = text;
  };

  for (const { question, value } of input.answers) {
    if (skip.has(question.key)) continue;
    add(question.label.en || question.key, renderAnswer(question, value));
  }

  add("Service path", pathName(input.growthPath));
  add("Language", languageNames[input.language]);
  add("Campaign", input.utm.campaign ?? "");
  add("Ad source", input.utm.source ?? "");
  add("Ad medium", input.utm.medium ?? "");
  // Lets whoever works the lead in the CRM find the same record in the lead
  // desk, which holds the full answer history and the notes.
  add("Lead ID", input.leadId);
  return fields;
}

export function buildCrmLead(input: CrmLeadInput): LeadClientLead {
  const fields = buildFields(input);
  const summary = [
    `Website enquiry - ${pathName(input.growthPath)} path, submitted in ${languageNames[input.language]}.`,
    "",
    ...Object.entries(fields).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  return {
    name: clamp(input.name ?? "", LIMITS.name),
    phone: clamp(input.phone ?? "", LIMITS.phone),
    email: clamp(input.email ?? "", LIMITS.email),
    // The whole record goes in the body as well as in `fields`, because a CRM
    // view that shows only the enquiry text should still show every answer.
    message: clamp(summary, LIMITS.message),
    fields,
    gclid: input.utm.gclid ?? "",
    // The connector's honeypot. A real visitor never fills it, and neither do
    // we - a value here would have the CRM discard the lead as spam.
    company_website: "",
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one stored lead. Resolves with what happened; throws only when every
 * attempt failed, so the caller can log a lead worth re-entering by hand.
 * Never call this before the lead is committed to the database.
 */
export async function sendLeadToCrm(
  input: CrmLeadInput,
  {
    client = getCrmClient(),
    wait = sleep,
  }: { client?: LeadClient; wait?: (ms: number) => Promise<unknown> } = {},
): Promise<CrmSendResult> {
  const lead = buildCrmLead(input);
  // The connector throws on either, and the questionnaire makes both required,
  // so this only trips on a legacy form version submitted during the 24-hour
  // archive window.
  if (!lead.name || !lead.phone) {
    return { status: "skipped", reason: "the lead has no name or no phone number" };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await wait(RETRY_DELAYS_MS[attempt - 1]);
    try {
      // One stable requestId across every attempt is what makes a retry safe:
      // the CRM deduplicates on it rather than storing the lead again.
      await client.submit(lead, {
        requestId: input.leadId,
        origin: input.origin,
        pageUrl: input.pageUrl,
      });
      return { status: "sent", attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
