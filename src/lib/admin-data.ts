import "server-only";

import { getSql } from "@/lib/db";
import type { DashboardFilters } from "@/lib/dashboard-filters";
import { dashboardQuery, type DashboardAnalytics } from "@/lib/dashboard-query";
import {
  blindIndex,
  decryptField,
  fieldAad,
  normalizeEmailForIndex,
  normalizePhoneForIndex,
} from "@/lib/lead-crypto";
import type { LeadDetail, LeadListItem, LeadStatus, Locale } from "@/lib/types";

type LeadRow = {
  id: string;
  name: string | null;
  phone_enc: string | null;
  email_enc: string | null;
  city: string | null;
  language: Locale;
  status: LeadStatus;
  source: string | null;
  created_at: string | Date;
};

const LEAD_COLUMNS = "id, name, phone_enc, email_enc, city, language, status, source, created_at";

/**
 * Decryption failures here (wrong/missing key, corrupted row) surface as
 * "-" rather than crashing the whole dashboard - one unreadable lead should
 * not take down the page for every other lead. Failures are still logged so
 * they don't go unnoticed.
 */
function decryptOrNull(value: string | null, aad: string, field: string, leadId: string): string | null {
  if (!value) return null;
  try {
    return decryptField(value, aad);
  } catch (error) {
    console.error(`Could not decrypt ${field} for lead ${leadId}.`, error);
    return null;
  }
}

function toLead(row: LeadRow): LeadListItem {
  return {
    id: row.id,
    name: row.name,
    phone: decryptOrNull(row.phone_enc, fieldAad(row.id, "phone"), "phone", row.id),
    email: decryptOrNull(row.email_enc, fieldAad(row.id, "email"), "email", row.id),
    city: row.city,
    language: row.language,
    status: row.status,
    source: row.source,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getDashboardData(filters: DashboardFilters) {
  const sql = getSql();
  const report = dashboardQuery(filters);
  const [analyticsRows, recentRows, optionsRows] = await Promise.all([
    sql.query(report.query, report.params),
    sql.query(`SELECT ${LEAD_COLUMNS} FROM leads WHERE ${report.scope}
      AND created_at >= $2::timestamptz ORDER BY created_at DESC, id DESC LIMIT 7`, report.scopeParams),
    sql.query(`SELECT
      coalesce(json_agg(DISTINCT coalesce(nullif(source, ''), 'direct') ORDER BY coalesce(nullif(source, ''), 'direct')), '[]'::json) AS sources,
      coalesce(json_agg(DISTINCT coalesce(nullif(utm->>'campaign', ''), '(untagged)') ORDER BY coalesce(nullif(utm->>'campaign', ''), '(untagged)')), '[]'::json) AS campaigns
      FROM leads`),
  ]);
  return {
    analytics: (analyticsRows as { analytics: DashboardAnalytics }[])[0].analytics,
    recent: (recentRows as LeadRow[]).map(toLead),
    options: (optionsRows as { sources: string[]; campaigns: string[] }[])[0],
  };
}

export async function getLeads({
  search = "",
  status = "",
}: {
  search?: string;
  status?: string;
}) {
  const sql = getSql();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (status && ["new", "contacted", "qualified", "won", "not_interested"].includes(status)) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }

  const normalizedSearch = search.trim().slice(0, 100);
  if (normalizedSearch) {
    // name and city stay in plain text, so "Raj" still finds "Rajesh" the way
    // it always has. phone and email are encrypted, so there is no column to
    // ILIKE - instead, if the search term itself normalizes to a complete
    // phone number or a well-formed email address, its blind index is looked
    // up for an exact match. A partial phone/email ("98765", "@gmail.com")
    // will not match; that trade-off is documented in the README.
    const textClauses: string[] = [];

    params.push(`%${normalizedSearch}%`);
    const likeParam = params.length;
    textClauses.push(`coalesce(name, '') ILIKE $${likeParam}`, `coalesce(city, '') ILIKE $${likeParam}`);

    const phoneCandidate = normalizePhoneForIndex(normalizedSearch);
    if (phoneCandidate) {
      params.push(blindIndex(phoneCandidate));
      textClauses.push(`phone_bidx = $${params.length}`);
    }

    if (normalizedSearch.includes("@")) {
      params.push(blindIndex(normalizeEmailForIndex(normalizedSearch)));
      textClauses.push(`email_bidx = $${params.length}`);
    }

    clauses.push(`(${textClauses.join(" OR ")})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT ${LEAD_COLUMNS}
     FROM leads
     ${where}
     ORDER BY created_at DESC
     LIMIT 250`,
    params,
  )) as LeadRow[];

  return rows.map(toLead);
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT ${LEAD_COLUMNS},
            referrer, utm, consent_at
     FROM leads WHERE id = $1 LIMIT 1`,
    [id],
  )) as Array<LeadRow & { referrer: string | null; utm: Record<string, string>; consent_at: string | Date }>;
  const lead = rows[0];
  if (!lead) return null;

  const [answerRows, noteRows] = await Promise.all([
    sql.query(
      `SELECT id, question_key, answer, question_snapshot
       FROM lead_answers WHERE lead_id = $1 ORDER BY created_at ASC`,
      [id],
    ),
    sql.query(
      `SELECT ln.id, ln.note, ln.created_at, au.email AS admin_email
       FROM lead_notes ln
       JOIN admin_users au ON au.id = ln.admin_id
       WHERE ln.lead_id = $1
       ORDER BY ln.created_at DESC`,
      [id],
    ),
  ]);

  return {
    ...toLead(lead),
    referrer: lead.referrer,
    utm: lead.utm ?? {},
    consentAt: new Date(lead.consent_at).toISOString(),
    answers: (answerRows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      questionKey: String(row.question_key),
      answer: row.answer,
      questionSnapshot: row.question_snapshot as LeadDetail["answers"][number]["questionSnapshot"],
    })),
    notes: (noteRows as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      note: String(row.note),
      createdAt: new Date(row.created_at as string | Date).toISOString(),
      adminEmail: String(row.admin_email),
    })),
  };
}
