import type { GrowthPath, Locale, PublicQuestion } from "@/lib/types";

// Deliberately no `import "server-only"` here, for the same reason as
// src/lib/lead-crypto.ts: scripts/test-crm-forward.ts imports this module via
// tsx, outside Next's bundler, where that marker throws unconditionally.
// CRM_LEAD_FORM_URL is not a NEXT_PUBLIC_* variable, so Next never inlines it
// into client JavaScript and an accidental client import fails closed.

/**
 * Mirrors every stored lead into the Leadgen CRM at leadgen.globalsurat.com.
 *
 * The CRM publishes a browser connector (`assets/lead-form.js`) that renders
 * its own form and posts it. We do not use it, for two reasons:
 *
 *   1. The public form here is a React, one-question-at-a-time flow. The
 *      connector binds a capturing `submit` listener and calls
 *      stopImmediatePropagation(), which would kill this app's own handler,
 *      and it reads values off mounted `input name=...` elements - most of
 *      which are unmounted by the time the last step is reached.
 *   2. `connect-src` in next.config.ts allows 'self' and Google Tag Manager
 *      only, so the connector's fetch would be blocked by the CSP anyway.
 *
 * Instead the lead is forwarded from the server, after it is safely committed
 * to Postgres, against the same JSON endpoint the connector talks to. Wire
 * protocol, taken from that script:
 *
 *   GET  endpoint  -> { ok: true, form: { challenge, title, button, success } }
 *   POST endpoint  <- { name, phone, email, message, company_website,
 *                       page_url, gclid, fields, request_id, challenge }
 *                  -> { ok: true, message }
 *
 * The CRM is a mirror, never the system of record: this app's own database
 * already holds the lead before any of this runs, and every failure path here
 * is reported to the caller rather than surfaced to the visitor.
 */

const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [1_000, 4_000];

// The connector clamps these in the browser before it posts, and the CRM
// rejects an entire submission that exceeds one. Truncating a long answer
// keeps the rest of the lead, which is always the better trade here.
const LIMITS = { name: 120, phone: 35, email: 254, message: 4_000, field: 1_000 };

const languageNames: Record<Locale, string> = { en: "English", hi: "Hindi", gu: "Gujarati" };
const growthPathNames: Record<GrowthPath | "general", string> = {
  lead_generation: "Lead Generation",
  d2c_growth: "D2C Growth",
  general: "General",
};

export type CrmConfig = { endpoint: string; formToken: string };

export type CrmLeadInput = {
  leadId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  language: Locale;
  growthPath: GrowthPath | "general";
  pageUrl: string;
  utm: Record<string, string>;
  answers: ReadonlyArray<{ question: PublicQuestion; value: unknown }>;
  /** Question keys already carried by the dedicated name/phone/email slots. */
  contactKeys?: readonly string[];
};

export type CrmPayload = {
  name: string;
  phone: string;
  email: string;
  message: string;
  company_website: string;
  page_url: string;
  gclid: string;
  fields: Record<string, string>;
  request_id: string;
};

export type CrmForwardResult =
  | { status: "sent"; attempts: number }
  | { status: "disabled" }
  | { status: "skipped"; reason: string };

type CrmResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  form?: { challenge?: string };
};

/**
 * Reads the connection link the CRM hands out - the one behind its "Send an
 * enquiry" button - and derives the JSON endpoint from it. `website-leads.php`
 * is resolved relative to the form page exactly as the connector resolves it
 * relative to its own `src`, so a CRM served from a subpath still works.
 *
 * Returns null when the variable is unset (forwarding is simply off). A value
 * that is set but unusable throws, so a typo is reported instead of silently
 * dropping every lead on the floor.
 */
export function readCrmConfig(value = process.env.CRM_LEAD_FORM_URL): CrmConfig | null {
  const raw = value?.trim();
  if (!raw) return null;

  let formUrl: URL;
  try {
    formUrl = new URL(raw);
  } catch {
    throw new Error("CRM_LEAD_FORM_URL is not a valid URL.");
  }

  // The lead's name, phone and email leave this server in the clear; plain
  // http would put them on the wire that way too.
  if (formUrl.protocol !== "https:") throw new Error("CRM_LEAD_FORM_URL must use https.");

  const formToken = formUrl.searchParams.get("form")?.trim();
  if (!formToken) throw new Error("CRM_LEAD_FORM_URL is missing its ?form= token.");

  const endpoint = new URL("website-leads.php", formUrl);
  endpoint.searchParams.set("form", formToken);
  return { endpoint: endpoint.toString(), formToken };
}

function clamp(value: string, max: number) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Renders one stored answer the way the lead desk renders it, so the CRM shows
 * "Google Ads" rather than the option id `google_ads`.
 */
function renderAnswer(question: PublicQuestion, value: unknown) {
  const resolve = (item: unknown) =>
    question.options.find((option) => option.id === item)?.label.en ?? String(item ?? "");
  return Array.isArray(value)
    ? value.map(resolve).filter(Boolean).join(", ")
    : resolve(value);
}

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

  add("Service path", growthPathNames[input.growthPath]);
  add("Language", languageNames[input.language]);
  add("Campaign", input.utm.campaign ?? "");
  add("Ad source", input.utm.source ?? "");
  add("Ad medium", input.utm.medium ?? "");
  // Lets whoever works the lead in the CRM find the same record in the lead
  // desk, which holds the full answer history and the notes.
  add("Lead ID", input.leadId);
  return fields;
}

export function buildCrmPayload(input: CrmLeadInput): CrmPayload {
  const fields = buildFields(input);
  const summary = [
    `Website enquiry - ${growthPathNames[input.growthPath]} path, submitted in ${languageNames[input.language]}.`,
    "",
    ...Object.entries(fields).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");

  return {
    name: clamp(input.name ?? "", LIMITS.name),
    phone: clamp(input.phone ?? "", LIMITS.phone),
    email: clamp(input.email ?? "", LIMITS.email),
    // The whole record goes in the body as well as in `fields`, because a CRM
    // view that shows only the enquiry text should still show the full answer.
    message: clamp(summary, LIMITS.message),
    // The connector's honeypot. A real visitor never fills it, and neither do
    // we - sending anything here would have the CRM discard the lead as spam.
    company_website: "",
    page_url: input.pageUrl,
    gclid: input.utm.gclid ?? "",
    fields,
    // The connector reuses one id across retries of the same enquiry, so the
    // CRM deduplicates on it. Our lead id is already unique per stored lead and
    // stable across every retry below, which makes the whole hop idempotent.
    request_id: input.leadId,
  };
}

/** The page the visitor submitted from, in the `origin + pathname` shape the connector sends. */
export function landingPageUrl(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    // Parsed with no base on purpose: a Referer is always absolute, so a
    // relative or malformed one is junk that must not reach the CRM as a URL.
    const referer = new URL(request.headers.get("referer") ?? "");
    // A cross-site Referer must not decide what we tell the CRM either.
    return referer.origin === origin ? `${referer.origin}${referer.pathname}` : `${origin}/`;
  } catch {
    return `${origin}/`;
  }
}

async function crmRequest(endpoint: string, fetchImpl: typeof fetch, body?: unknown) {
  const response = await fetchImpl(endpoint, {
    method: body ? "POST" : "GET",
    // Next patches fetch and caches GETs; a reused challenge is a rejected POST.
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: body ? { "Content-Type": "application/json" } : { Accept: "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const result = (await response.json()) as CrmResponse;
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `The CRM responded with ${response.status}.`);
  }
  return result;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one stored lead to the CRM. Resolves with what happened; throws only
 * when every attempt failed, so the caller can log a lead worth re-entering by
 * hand. Never call this before the lead is committed to the database.
 */
export async function forwardLeadToCrm(
  input: CrmLeadInput,
  {
    config = readCrmConfig(),
    fetchImpl = fetch,
    wait = sleep,
  }: {
    config?: CrmConfig | null;
    fetchImpl?: typeof fetch;
    wait?: (ms: number) => Promise<unknown>;
  } = {},
): Promise<CrmForwardResult> {
  if (!config) return { status: "disabled" };

  const payload = buildCrmPayload(input);
  // The CRM requires both and rejects the submission otherwise. The
  // questionnaire makes them required, so this only trips on a legacy form
  // version submitted during the 24-hour archive window.
  if (!payload.name || !payload.phone) {
    return { status: "skipped", reason: "the lead has no name or no phone number" };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await wait(RETRY_DELAYS_MS[attempt - 1]);
    try {
      // Each attempt takes a fresh challenge: it carries a timestamp and the
      // CRM spends it, so a retry cannot replay the one that just failed.
      const { form } = await crmRequest(config.endpoint, fetchImpl);
      await crmRequest(config.endpoint, fetchImpl, { ...payload, challenge: form?.challenge ?? "" });
      return { status: "sent", attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
