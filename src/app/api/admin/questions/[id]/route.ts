import { getAdminSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { isSameOrigin, jsonError } from "@/lib/security";
import type { QuestionConfig, QuestionOption, QuestionType } from "@/lib/types";
import { questionPayloadSchema } from "@/lib/validation";

const choiceTypes = new Set(["single_choice", "multi_choice", "dropdown"]);

type ExistingQuestionRow = {
  id: string;
  question_key: string;
  question_type: QuestionType;
  required: boolean;
  options: QuestionOption[];
  config: QuestionConfig;
  is_active: boolean;
};

function sameOptionStructure(left: QuestionOption[], right: QuestionOption[]) {
  return (
    left.length === right.length &&
    left.every((option, index) => option.id === right[index]?.id)
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Request origin was not accepted.", 403);
  const admin = await getAdminSession();
  if (!admin) return jsonError("Please sign in again.", 401);
  if (admin.role === "viewer") return jsonError("Your account is read-only.", 403);

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid question data.", 400);
  }

  const parsed = questionPayloadSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Check the question fields.", 400);
  const question = parsed.data;
  if (choiceTypes.has(question.type) && question.options.length < 2) {
    return jsonError("Choice questions need at least two options.", 400);
  }

  try {
    const sql = getSql();
    const existingRows = (await sql.query(
      `SELECT q.id, q.question_key, q.question_type, q.required,
              q.options, q.config, q.is_active
       FROM questions q
       JOIN form_versions fv ON fv.id = q.version_id
       WHERE q.id = $1 AND fv.status = 'draft'
       LIMIT 1`,
      [id],
    )) as ExistingQuestionRow[];
    const existing = existingRows[0];
    if (!existing) return jsonError("Question was not found in the current draft.", 404);

    const existingRole = existing.config.systemRole;
    if (!existingRole && question.config.systemRole) {
      return jsonError("Core form roles cannot be assigned to regular questions.", 400);
    }

    if (existingRole) {
      const structureChanged =
        question.key !== existing.question_key ||
        question.type !== existing.question_type ||
        question.required !== existing.required ||
        question.isActive !== existing.is_active ||
        question.config.systemRole !== existingRole ||
        question.config.flow !== existing.config.flow ||
        question.config.track !== existing.config.track;
      if (structureChanged) {
        return jsonError(
          "This is a core form question. Edit its wording without changing its key, type, path, or required/visible settings.",
          400,
        );
      }

      // Both selectors drive branching off their option ids, so those ids and
      // their order are fixed even though the wording stays editable.
      if (
        (existingRole === "flow_selector" || existingRole === "track_selector") &&
        !sameOptionStructure(existing.options ?? [], question.options)
      ) {
        return jsonError(
          existingRole === "flow_selector"
            ? "The service-path selector options cannot be added, removed, reordered, or replaced."
            : "The path-track selector options cannot be added, removed, reordered, or replaced.",
          400,
        );
      }
    }

    const savedConfig: QuestionConfig = existingRole
      ? {
          ...question.config,
          flow: existing.config.flow,
          track: existing.config.track,
          systemRole: existingRole,
        }
      : { ...question.config, systemRole: undefined };
    const savedKey = existingRole ? existing.question_key : question.key;
    const savedType = existingRole ? existing.question_type : question.type;
    const savedRequired = existingRole ? existing.required : question.required;
    const savedActive = existingRole ? existing.is_active : question.isActive;

    const rows = (await sql.query(
      `UPDATE questions q
       SET question_key = $1,
           question_type = $2,
           label = $3::jsonb,
           help_text = $4::jsonb,
           placeholder = $5::jsonb,
           required = $6,
           options = $7::jsonb,
           config = $8::jsonb,
           is_active = $9,
           updated_at = now()
       FROM form_versions fv
       WHERE q.id = $10
         AND q.version_id = fv.id
         AND fv.status = 'draft'
       RETURNING q.id`,
      [
        savedKey,
        savedType,
        JSON.stringify(question.label),
        JSON.stringify(question.helpText),
        JSON.stringify(question.placeholder),
        savedRequired,
        JSON.stringify(question.options),
        JSON.stringify(savedConfig),
        savedActive,
        id,
      ],
    )) as { id: string }[];

    if (!rows[0]) return jsonError("Question was not found in the current draft.", 404);

    await sql.query(
      `INSERT INTO audit_log (admin_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'question.updated', 'question', $2, $3::jsonb)`,
      [admin.id, id, JSON.stringify({ key: savedKey })],
    );

    return Response.json({ ok: true });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return jsonError("That question key is already in use.", 409);
    console.error("Question update failed.", error);
    return jsonError("Could not update the question.", 503);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Request origin was not accepted.", 403);
  const admin = await getAdminSession();
  if (!admin) return jsonError("Please sign in again.", 401);
  if (admin.role === "viewer") return jsonError("Your account is read-only.", 403);

  const { id } = await context.params;

  try {
    const sql = getSql();
    const rows = (await sql.query(
      `WITH target AS MATERIALIZED (
         SELECT q.id, q.question_key, q.config
         FROM questions q
         JOIN form_versions fv ON fv.id = q.version_id
         WHERE q.id = $1 AND fv.status = 'draft'
       ), deleted AS (
         DELETE FROM questions q
         USING target t
         WHERE q.id = t.id
           AND (t.config->>'systemRole') IS NULL
         RETURNING q.id
       )
       SELECT t.id AS target_id, t.question_key, t.config,
              d.id AS deleted_id
       FROM target t
       LEFT JOIN deleted d ON d.id = t.id`,
      [id],
    )) as Array<{
      target_id: string;
      question_key: string;
      config: QuestionConfig;
      deleted_id: string | null;
    }>;
    const target = rows[0];
    if (!target) return jsonError("Question was not found in the current draft.", 404);
    if (!target.deleted_id) {
      return jsonError("Core form questions cannot be deleted. Edit their wording instead.", 400);
    }

    await sql.query(
      `INSERT INTO audit_log (admin_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'question.deleted', 'question', $2, $3::jsonb)`,
      [admin.id, id, JSON.stringify({ key: target.question_key })],
    );
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Question deletion failed.", error);
    return jsonError("Could not delete the question.", 503);
  }
}
