import { z } from "zod";

import { isSameOrigin, jsonError } from "@/lib/security";

export const MAX_LEAD_DELETION = 250;
const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_LEAD_DELETION),
  confirmed: z.literal(true),
}).strict();

type DeleteDependencies = {
  getAdmin: () => Promise<{ id: string; role: string } | null>;
  remove: (ids: string[], adminId: string) => Promise<string[]>;
};

// Deletion, cascading answers/notes, and audit records commit or roll back together.
// Only IDs are returned or retained in the deletion audit; no contact data is copied.
export const deleteLeadsSql = `WITH deleted AS (
  DELETE FROM leads WHERE id = ANY($1::uuid[]) RETURNING id
), audited AS (
  INSERT INTO audit_log (admin_id, action, entity_type, entity_id, metadata)
  SELECT $2::uuid, 'lead.deleted', 'lead', id, '{}'::jsonb FROM deleted
  RETURNING entity_id
)
SELECT entity_id AS id FROM audited`;

export async function handleLeadDeletion(request: Request, dependencies: DeleteDependencies) {
  if (!isSameOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonError("Request origin was not accepted.", 403);
  }
  const admin = await dependencies.getAdmin();
  if (!admin) return jsonError("Please sign in again.", 401);
  if (!["owner", "editor"].includes(admin.role)) return jsonError("Your account cannot delete leads.", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return jsonError("Send a JSON deletion request.", 415);
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 20_000) return jsonError("Select no more than 250 leads at once.", 413);
    body = JSON.parse(text);
  } catch {
    return jsonError("Invalid deletion request.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Confirm a selection of 1 to 250 valid leads.", 400);
  const ids = [...new Set(parsed.data.ids)];
  try {
    const deletedIds = await dependencies.remove(ids, admin.id);
    return Response.json({ ok: true, deletedCount: deletedIds.length, deletedIds }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("Lead deletion failed.");
    return jsonError("Could not complete deletion. Refresh the list to check its current state before trying again.", 503);
  }
}
