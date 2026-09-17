import crypto from "node:crypto";

import { getSql } from "@/lib/db";
import {
  blindIndex,
  encryptField,
  fieldAad,
  normalizeEmailForIndex,
  normalizePhoneForIndex,
} from "@/lib/lead-crypto";
import { issueLeadReceipt } from "@/lib/lead-receipt";
import {
  getSelectedGrowthPath,
  getVisibleQuestions,
  isGrowthPath,
} from "@/lib/questionnaire-flow";
import { rateLimit, requestFingerprint } from "@/lib/rate-limit";
import { jsonError } from "@/lib/security";
import type {
  GrowthPath,
  Locale,
  PublicQuestion,
  QuestionConfig,
  QuestionOption,
  QuestionType,
} from "@/lib/types";
import { leadSubmissionSchema, validateQuestionAnswer } from "@/lib/validation";

export const runtime = "nodejs";

type QuestionRow = {
  id: string;
  question_key: string;
  question_type: QuestionType;
  label: PublicQuestion["label"];
  help_text: PublicQuestion["helpText"];
  placeholder: PublicQuestion["placeholder"];
  required: boolean;
  position: number;
  options: QuestionOption[];
  config: QuestionConfig;
  is_active: boolean;
};

type ExistingLeadRow = {
  id: string;
  growth_path: unknown;
};

function toPublicQuestion(row: QuestionRow): PublicQuestion {
  return {
    id: row.id,
    key: row.question_key,
    type: row.question_type,
    label: row.label,
    helpText: row.help_text,
    placeholder: row.placeholder,
    required: row.required,
    position: row.position,
    options: row.options ?? [],
    config: row.config ?? {},
    isActive: row.is_active,
  };
}

async function findExistingLead(submissionToken: string) {
  const sql = getSql();
  const rows = (await sql.query(
    `SELECT l.id,
            (SELECT la.answer
             FROM lead_answers la
             WHERE la.lead_id = l.id AND la.question_key = 'growth_path'
             LIMIT 1) AS growth_path
     FROM leads l
     WHERE l.submission_token = $1
     LIMIT 1`,
    [submissionToken],
  )) as ExistingLeadRow[];
  return rows[0] ?? null;
}

async function successResponse(
  leadId: string,
  locale: Locale,
  growthPath: GrowthPath | "general",
  status = 200,
) {
  await issueLeadReceipt(leadId, locale, growthPath);
  return Response.json({ ok: true, leadId }, { status });
}

export async function POST(request: Request) {
  const fingerprint = requestFingerprint(request);
  if (!rateLimit(`lead:${fingerprint}`, 12, 10 * 60 * 1000).allowed) {
    return jsonError("Too many attempts. Please wait a few minutes and try again.", 429);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonError("Please send a valid form submission.", 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("We could not read your answers. Please try again.", 400);
  }

  const parsed = leadSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Please check the form and try again.", 400);
  }

  const payload = parsed.data;
  const completionMs = Date.now() - payload.startedAt;
  if (completionMs < 1500 || completionMs > 6 * 60 * 60 * 1000) {
    return jsonError("This form session has expired. Please refresh and try again.", 400);
  }

  try {
    const sql = getSql();
    const formRows = (await sql.query(
      `SELECT fv.id
       FROM form_versions fv
       JOIN forms f ON f.id = fv.form_id
       WHERE fv.id = $1
         AND f.id = $2
         AND (
           fv.status = 'published'
           OR (fv.status = 'archived' AND fv.updated_at > now() - interval '24 hours')
         )
       LIMIT 1`,
      [payload.versionId, payload.formId],
    )) as { id: string }[];

    if (!formRows[0]) {
      return jsonError("The questions were updated. Please refresh and try once more.", 409);
    }

    const questionRows = (await sql.query(
      `SELECT id, question_key, question_type, label, help_text, placeholder,
              required, position, options, config, is_active
       FROM questions
       WHERE version_id = $1 AND is_active = true
       ORDER BY position ASC`,
      [payload.versionId],
    )) as QuestionRow[];

    const questions = questionRows.map(toPublicQuestion);
    const allowedKeys = new Set(questions.map((question) => question.key));
    if (Object.keys(payload.answers).some((key) => !allowedKeys.has(key))) {
      return jsonError("The form contains an answer we do not recognize.", 400);
    }

    const visibleQuestions = getVisibleQuestions(questions, payload.answers);
    const visibleKeys = new Set(visibleQuestions.map((question) => question.key));
    if (Object.keys(payload.answers).some((key) => !visibleKeys.has(key))) {
      return jsonError("Your answers no longer match the selected growth path. Please review the form.", 400);
    }

    const validatedAnswers: Array<{
      question: PublicQuestion;
      value: unknown;
    }> = [];

    for (const question of visibleQuestions) {
      const result = validateQuestionAnswer(question, payload.answers[question.key]);
      if (!result.ok) {
        return Response.json(
          { ok: false, message: result.message, questionKey: question.key },
          { status: 400 },
        );
      }
      if (result.value !== null) validatedAnswers.push({ question, value: result.value });
    }

    const existing = await findExistingLead(payload.submissionToken);
    if (existing) {
      const existingGrowthPath = isGrowthPath(existing.growth_path)
        ? existing.growth_path
        : "general";
      return successResponse(existing.id, payload.language, existingGrowthPath);
    }

    const byKey = new Map(validatedAnswers.map((item) => [item.question.key, item.value]));
    const valueForRole = (role: "contact_name" | "contact_phone", legacyKey: string) =>
      validatedAnswers.find((item) => item.question.config.systemRole === role)?.value
      ?? byKey.get(legacyKey);
    const nameValue = valueForRole("contact_name", "full_name");
    const phoneValue = valueForRole("contact_phone", "phone");
    const emailValue = byKey.get("email");
    const cityValue = byKey.get("city");
    const name = typeof nameValue === "string" ? nameValue : null;
    const phone = typeof phoneValue === "string" ? phoneValue : null;
    const email = typeof emailValue === "string" ? emailValue : null;
    const city = typeof cityValue === "string" ? cityValue : null;
    const leadId = crypto.randomUUID();

    // Phone and email are never written in plain text — see src/lib/lead-crypto.ts.
    // The blind index is a keyed hash of the normalized value, computed here
    // (not in SQL) so the admin search box can look up an exact match without
    // the database ever holding the plaintext or an unkeyed, guessable hash.
    const phoneEnc = phone ? encryptField(phone, fieldAad(leadId, "phone")) : null;
    const phoneBidx = phone ? blindIndex(normalizePhoneForIndex(phone) ?? phone) : null;
    const emailEnc = email ? encryptField(email, fieldAad(leadId, "email")) : null;
    const emailBidx = email ? blindIndex(normalizeEmailForIndex(email)) : null;

    const attribution = payload.attribution ?? {};
    const utm = {
      source: attribution.utmSource ?? "",
      medium: attribution.utmMedium ?? "",
      campaign: attribution.utmCampaign ?? "",
      content: attribution.utmContent ?? "",
      term: attribution.utmTerm ?? "",
      fbclid: attribution.fbclid ?? "",
      gclid: attribution.gclid ?? "",
    };

    const queries = [
      sql.query(
        `INSERT INTO leads (
          id, form_id, form_version_id, language, name,
          phone_enc, phone_bidx, email_enc, email_bidx, city,
          status, source, referrer, utm, consent_at, submission_token
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          'new', $11, $12, $13::jsonb, now(), $14
        )`,
        [
          leadId,
          payload.formId,
          payload.versionId,
          payload.language,
          name,
          phoneEnc,
          phoneBidx,
          emailEnc,
          emailBidx,
          city,
          attribution.utmSource || attribution.source || (attribution.fbclid ? "facebook" : "direct"),
          attribution.referrer || null,
          JSON.stringify(utm),
          payload.submissionToken,
        ],
      ),
      ...validatedAnswers.map(({ question, value }) =>
        sql.query(
          `INSERT INTO lead_answers (
            id, lead_id, question_id, question_key, answer, question_snapshot
          ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
          [
            crypto.randomUUID(),
            leadId,
            question.id,
            question.key,
            JSON.stringify(value),
            JSON.stringify({
              type: question.type,
              label: question.label,
              options: question.options,
            }),
          ],
        ),
      ),
    ];

    await sql.transaction(queries);
    const growthPath = getSelectedGrowthPath(questions, payload.answers) ?? "general";
    return successResponse(leadId, payload.language, growthPath, 201);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      const existing = await findExistingLead(payload.submissionToken);
      if (existing) {
        const existingGrowthPath = isGrowthPath(existing.growth_path)
          ? existing.growth_path
          : "general";
        return successResponse(existing.id, payload.language, existingGrowthPath);
      }
    }

    console.error("Lead submission failed.", error);
    return jsonError("Something went wrong while saving your details. Please try again.", 503);
  }
}
