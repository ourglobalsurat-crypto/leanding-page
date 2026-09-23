/**
 * Types for the vendor's lead-client.mjs, which ships without any.
 * Only what this app calls is described, following the same approach as
 * src/types/xlsx-populate.d.ts. Keep in step with lead-client.mjs if the CRM
 * publishes a new version of that file.
 */

export type LeadClientLead = {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  /** Extra per-question values, shown in the CRM beside the enquiry. */
  fields?: Record<string, string>;
  gclid?: string;
  /** The connector's honeypot. Leave empty; a value marks the lead as spam. */
  company_website?: string;
};

export type LeadClientOptions = {
  /** Stable id, 20-80 of [a-zA-Z0-9-]. Reuse it across retries so the CRM deduplicates. */
  requestId?: string;
  /** Required on a server: the site origin configured in Leadgen. */
  origin?: string;
  /** Must share an origin with `origin`; only its pathname is sent. */
  pageUrl?: string;
};

export type LeadClientResult = { ok: true; message?: string };

export type LeadClient = {
  submit(lead: LeadClientLead, options?: LeadClientOptions): Promise<LeadClientResult>;
};

/** Throws unless `formLink` is a complete Leadgen website-form.php link. */
export function createLeadClient(formLink: string): LeadClient;
