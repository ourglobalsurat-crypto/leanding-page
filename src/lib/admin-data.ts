import "server-only";

import { getSql } from "@/lib/db";
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
 * "—" rather than crashing the whole dashboard — one unreadable lead should
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

export async function getDashboardData() {
  const sql = getSql();
  const [statsRows, recentRows, dailyRows, sourceRows] = await Promise.all([
    sql.query(
      `SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS today,
        count(*) FILTER (WHERE status = 'new')::int AS new_count,
        count(*) FILTER (WHERE status IN ('qualified', 'won'))::int AS qualified
       FROM leads`,
    ),
    sql.query(
      `SELECT ${LEAD_COLUMNS}
       FROM leads ORDER BY created_at DESC LIMIT 7`,
    ),
    sql.query(
      `WITH days AS (
         SELECT generate_series(
           date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '6 days',
           date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata'),
           interval '1 day'
         ) AS day
       )
       SELECT to_char(days.day, 'Dy') AS label,
              count(leads.id)::int AS count
       FROM days
       LEFT JOIN leads
         ON (leads.created_at AT TIME ZONE 'Asia/Kolkata') >= days.day
        AND (leads.created_at AT TIME ZONE 'Asia/Kolkata') < days.day + interval '1 day'
       GROUP BY days.day
       ORDER BY days.day`,
    ),
    sql.query(
      `SELECT coalesce(nullif(source, ''), 'direct') AS source, count(*)::int AS count
       FROM leads GROUP BY 1 ORDER BY count DESC LIMIT 5`,
    ),
  ]);

  const stats = (statsRows as Array<Record<string, number>>)[0] ?? {};
  return {
    stats: {
      total: Number(stats.total ?? 0),
      today: Number(stats.today ?? 0),
      newCount: Number(stats.new_count ?? 0),
      qualified: Number(stats.qualified ?? 0),
    },
    recent: (recentRows as LeadRow[]).map(toLead),
    daily: (dailyRows as { label: string; count: number }[]).map((row) => ({
      label: row.label.trim(),
      count: Number(row.count),
    })),
    sources: (sourceRows as { source: string; count: number }[]).map((row) => ({
      source: row.source,
      count: Number(row.count),
    })),
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
    // ILIKE — instead, if the search term itself normalizes to a complete
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
