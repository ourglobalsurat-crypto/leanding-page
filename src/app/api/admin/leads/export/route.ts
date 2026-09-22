import { getAdminSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { buildDecoyLeads } from "@/lib/decoy-leads";
import { toEncryptedXlsx } from "@/lib/encrypted-workbook";
import { resolveExportMode, shouldEchoContent, filePasswordFor } from "@/lib/export-unlock";
import { decryptField, fieldAad } from "@/lib/lead-crypto";
import { jsonError } from "@/lib/security";

// xlsx-populate needs the Node runtime, not the edge one.
export const runtime = "nodejs";

const HEADERS = [
  "Lead ID",
  "Received at (UTC)",
  "Name",
  "Phone",
  "Email",
  "City",
  "Language",
  "Status",
  "Source",
  "UTM",
  "Answers",
];

type Row = (string | number | null)[];

/** One row's ciphertext being unreadable should not fail the whole export. */
function decryptOrBlank(value: unknown, aad: string): string {
  if (!value) return "";
  try {
    return decryptField(value as string, aad);
  } catch (error) {
    console.error(`Could not decrypt a field for the export (${aad}).`, error);
    return "";
  }
}

async function realRows(): Promise<Row[]> {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT l.id, l.created_at, l.name, l.phone_enc, l.email_enc, l.city, l.language,
            l.status, l.source, l.utm,
            coalesce(jsonb_object_agg(la.question_key, la.answer)
              FILTER (WHERE la.question_key IS NOT NULL), '{}'::jsonb) AS answers
     FROM leads l
     LEFT JOIN lead_answers la ON la.lead_id = l.id
     GROUP BY l.id
     ORDER BY l.created_at DESC`,
  )) as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const leadId = String(row.id);
    return [
      leadId,
      new Date(row.created_at as string | Date).toISOString(),
      (row.name as string) ?? "",
      decryptOrBlank(row.phone_enc, fieldAad(leadId, "phone")),
      decryptOrBlank(row.email_enc, fieldAad(leadId, "email")),
      (row.city as string) ?? "",
      (row.language as string) ?? "",
      (row.status as string) ?? "",
      (row.source as string) ?? "",
      JSON.stringify(row.utm ?? {}),
      JSON.stringify(row.answers ?? {}),
    ];
  });
}

/**
 * Invented rows. The database is touched only for the number of leads, so the
 * file is a believable size; not one field below comes from a real record.
 */
async function decoyRows(): Promise<Row[]> {
  const sql = getSql();
  const counted = (await sql.query(`SELECT count(*)::int AS count FROM leads`)) as Array<{ count: number }>;

  return buildDecoyLeads(Number(counted[0]?.count ?? 0)).map((lead) => [
    lead.id,
    lead.createdAt,
    lead.name,
    lead.phone,
    lead.email,
    lead.city,
    lead.language,
    lead.status,
    lead.source,
    JSON.stringify(lead.utm),
    JSON.stringify(lead.answers),
  ]);
}

async function buildWorkbook(entered: string): Promise<Buffer> {
  const mode = resolveExportMode(entered);
  const rows: Row[] = [HEADERS, ...(mode === "real" ? await realRows() : await decoyRows())];

  // The field says "Add content", so content that is not a passphrase is added,
  // exactly as promised. This is what makes the control unremarkable.
  if (shouldEchoContent(entered)) {
    rows.push([], ["Content", entered]);
  }

  return toEncryptedXlsx(rows, filePasswordFor(entered));
}

function workbookResponse(body: Buffer): Response {
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="global-surat-leads-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) return jsonError("Please sign in again.", 401);

  let entered = "";
  try {
    const body = (await request.json()) as { content?: unknown };
    if (typeof body.content === "string") entered = body.content.slice(0, 2000);
  } catch {
    // An unreadable body is treated as an empty entry, which exports decoy
    // rows. Refusing here would tell the caller that the field matters.
  }

  try {
    return workbookResponse(await buildWorkbook(entered));
  } catch (error) {
    console.error("Lead export failed.", error);
    return jsonError("Could not export leads.", 503);
  }
}

/**
 * The plain "Export CSV" button, and anyone who requests this URL directly.
 * Both get decoy rows locked with the decoy passphrase, and no error - a 405
 * here would be a signpost saying the real data sits behind something else.
 */
export async function GET() {
  if (!(await getAdminSession())) return jsonError("Please sign in again.", 401);

  try {
    return workbookResponse(await buildWorkbook(""));
  } catch (error) {
    console.error("Lead export failed.", error);
    return jsonError("Could not export leads.", 503);
  }
}
