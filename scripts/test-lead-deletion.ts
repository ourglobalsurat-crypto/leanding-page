import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deleteLeadsSql, handleLeadDeletion } from "../src/lib/lead-deletion";

async function main() {
  const id = randomUUID(), other = randomUUID(), adminId = randomUUID();
  let role: string | null = "owner";
  let received: string[] = [];
  let calls = 0;
  const dependencies = {
    getAdmin: async () => role ? { id: adminId, role } : null,
    remove: async (ids: string[], actor: string) => { calls++; received = ids; assert.equal(actor, adminId); return ids; },
  };
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request("http://localhost/api/admin/leads", {
    method: "DELETE", headers: { "Content-Type": "application/json", Origin: "http://localhost", ...headers }, body: JSON.stringify(body),
  });
  const valid = { ids: [id, other], confirmed: true };
  role = null;
  assert.equal((await handleLeadDeletion(request(valid), dependencies)).status, 401);
  for (const denied of ["viewer", "unknown"]) {
    role = denied;
    assert.equal((await handleLeadDeletion(request(valid), dependencies)).status, 403);
  }
  role = "owner";
  assert.equal((await handleLeadDeletion(request(valid, { Origin: "https://other.example" }), dependencies)).status, 403);
  assert.equal((await handleLeadDeletion(request(valid, { "sec-fetch-site": "cross-site" }), dependencies)).status, 403);
  assert.equal((await handleLeadDeletion(request(valid, { "Content-Type": "text/plain" }), dependencies)).status, 415);
  for (const body of [{ ids: [] }, { ids: [id] }, { ids: [id], confirmed: false }, { ids: ["bad"], confirmed: true }, { ids: Array(251).fill(id), confirmed: true }, { ...valid, all: true }]) {
    assert.equal((await handleLeadDeletion(request(body), dependencies)).status, 400);
  }
  const malformed = new Request("http://localhost/api/admin/leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await handleLeadDeletion(malformed, dependencies)).status, 400);
  assert.equal(calls, 0, "Invalid or unauthorized requests must never invoke deletion");
  for (const allowed of ["owner", "editor"]) {
    role = allowed;
    const response = await handleLeadDeletion(request({ ids: [id, id, other], confirmed: true }), dependencies);
    assert.equal(response.status, 200);
    assert.deepEqual(received, [id, other]);
    assert.equal((await response.json()).deletedCount, 2);
  }
  const repeated = await handleLeadDeletion(request(valid), { ...dependencies, remove: async () => [] });
  assert.deepEqual(await repeated.json(), { ok: true, deletedCount: 0, deletedIds: [] });
  const failure = await handleLeadDeletion(request(valid), { ...dependencies, remove: async () => { throw new Error("fixture failure"); } });
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes("fixture failure"));
  console.log("PASS: authentication, roles, origin checks, confirmation, batch bounds, UUID validation, deduplication, repeat requests, safe errors.");

  if (process.argv.includes("--database")) {
    const { config } = await import("dotenv");
    const { neon } = await import("@neondatabase/serverless");
    config({ path: ".env.local", quiet: true });
    assert.ok(process.env.DATABASE_URL);
    const sql = neon(process.env.DATABASE_URL);
    const constraints = await sql.query(`SELECT conrelid::regclass::text AS child, confdeltype
      FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.leads'::regclass
      AND conrelid IN ('public.lead_answers'::regclass, 'public.lead_notes'::regclass)`);
    assert.equal(constraints.length, 2);
    assert.ok(constraints.every((row) => row.confdeltype === "c"), "Answers and notes must cascade on deletion");
    // All writes target session-local tables, dropped at commit. Never modify public tables.
    const fixtureSql = deleteLeadsSql.replace("DELETE FROM leads", "DELETE FROM pg_temp.leads").replace("INSERT INTO audit_log", "INSERT INTO pg_temp.audit_log");
    const untouched = randomUUID();
    const statements = [
      sql.query("CREATE TEMP TABLE leads (id uuid PRIMARY KEY) ON COMMIT DROP"),
      sql.query("CREATE TEMP TABLE lead_answers (lead_id uuid REFERENCES pg_temp.leads(id) ON DELETE CASCADE) ON COMMIT DROP"),
      sql.query("CREATE TEMP TABLE lead_notes (lead_id uuid REFERENCES pg_temp.leads(id) ON DELETE CASCADE) ON COMMIT DROP"),
      sql.query("CREATE TEMP TABLE audit_log (admin_id uuid, action text, entity_type text, entity_id uuid, metadata jsonb) ON COMMIT DROP"),
      sql.query("INSERT INTO pg_temp.leads SELECT unnest($1::uuid[])", [[id, other, untouched]]),
      sql.query("INSERT INTO pg_temp.lead_answers SELECT id FROM pg_temp.leads"),
      sql.query("INSERT INTO pg_temp.lead_notes SELECT id FROM pg_temp.leads"),
      sql.query(fixtureSql, [[id, other, id, randomUUID()], adminId]),
      sql.query("SELECT (SELECT count(*)::int FROM pg_temp.leads) AS leads, (SELECT count(*)::int FROM pg_temp.lead_answers) AS answers, (SELECT count(*)::int FROM pg_temp.lead_notes) AS notes, (SELECT count(*)::int FROM pg_temp.audit_log) AS audits"),
      sql.query(fixtureSql, [[id, other], adminId]),
      sql.query(fixtureSql, [[untouched], adminId]),
      sql.query("SELECT (SELECT count(*)::int FROM pg_temp.leads) AS leads, (SELECT count(*)::int FROM pg_temp.lead_answers) AS answers, (SELECT count(*)::int FROM pg_temp.lead_notes) AS notes, (SELECT count(*)::int FROM pg_temp.audit_log) AS audits"),
    ];
    const results = await sql.transaction(statements);
    assert.equal(results[7].length, 2);
    assert.deepEqual(results[8][0], { leads: 1, answers: 1, notes: 1, audits: 2 });
    assert.equal(results[9].length, 0);
    assert.equal(results[10].length, 1);
    assert.deepEqual(results[11][0], { leads: 0, answers: 0, notes: 0, audits: 3 });
    console.log("PASS: real cascade constraints, atomic SQL, single/bulk deletion, untouched records, cascading answers/notes, deletion audit, repeat safety. All writes used temporary tables.");
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
