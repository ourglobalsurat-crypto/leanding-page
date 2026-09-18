import assert from "node:assert/strict";
import { parseDashboardFilters, periodChange, shiftDate } from "../src/lib/dashboard-filters";
import { dashboardQuery, type DashboardAnalytics } from "../src/lib/dashboard-query";

const now = new Date("2026-09-17T18:30:00Z"); // Midnight on 18 September in IST.
const today = parseDashboardFilters({ range: "today" }, now);
assert.equal(today.start, "2026-09-18");
assert.equal(today.startAt, "2026-09-17T18:30:00.000Z");
assert.equal(today.endAt, "2026-09-18T18:30:00.000Z");
assert.equal(today.previousStart, "2026-09-17");
assert.equal(parseDashboardFilters({ range: "today" }, new Date("2026-09-17T18:29:59Z")).start, "2026-09-17");
assert.equal(parseDashboardFilters({ range: "yesterday" }, now).end, "2026-09-17");
assert.equal(parseDashboardFilters({ range: "month" }, now).start, "2026-09-01");
assert.equal(parseDashboardFilters({ range: "30d" }, now).days, 30);
assert.equal(parseDashboardFilters({ range: "custom", start: "2024-02-29", end: "2024-03-01" }, now).days, 2);
for (const [start, end] of [["2026-02-30", "2026-03-01"], ["2026-09-18", "2026-09-17"], ["2026-09-18", "2026-09-19"], ["2026-01-01", "2026-09-18"], ["invalid", ""]]) {
  const invalid = parseDashboardFilters({ range: "custom", start, end }, now);
  assert.equal(invalid.range, "7d");
  assert.ok(invalid.warning);
}
assert.equal(parseDashboardFilters({ range: ["today", "month"], status: "bad" }, now).status, "");
assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
assert.equal(periodChange(3, 2), "+50.0% vs previous period");
assert.equal(periodChange(3, 0), "No previous leads to compare");
assert.equal(periodChange(0, 0), "No change vs previous period");
const attack = "' OR 1=1 --";
const query = dashboardQuery(parseDashboardFilters({ source: attack }, now));
assert.ok(!query.query.includes(attack));
assert.equal(query.params[3], attack);
console.log("PASS: IST midnight, date presets, leap day, invalid ranges, comparisons, parameterized filters.");

async function checkDatabase() {
  const { config } = await import("dotenv");
  const { neon } = await import("@neondatabase/serverless");
  config({ path: ".env.local", quiet: true });
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for SQL checks");
  const sql = neon(process.env.DATABASE_URL);
  // A read-only CTE shadows the real table. No test records are written.
  const fixture = `WITH leads(created_at, status, source, utm) AS (VALUES
    ('2026-09-16T18:30:00Z'::timestamptz, 'new', 'google', '{"campaign":"launch"}'::jsonb),
    ('2026-09-17T18:29:59Z'::timestamptz, 'new', 'google', '{"campaign":"launch"}'::jsonb),
    ('2026-09-17T18:30:00Z'::timestamptz, 'qualified', 'google', '{"campaign":"launch"}'::jsonb),
    ('2026-09-18T01:00:00Z'::timestamptz, 'won', 'facebook', '{"campaign":"launch"}'::jsonb),
    ('2026-09-18T02:00:00Z'::timestamptz, 'new', NULL, '{}'::jsonb),
    ('2026-09-18T18:29:59Z'::timestamptz, 'contacted', '', '{}'::jsonb),
    ('2026-09-18T18:30:00Z'::timestamptz, 'new', 'google', '{"campaign":"launch"}'::jsonb)
  ), scoped AS`;
  async function report(search: Record<string, string>) {
    const spec = dashboardQuery(parseDashboardFilters({ range: "today", ...search }, now));
    const rows = await sql.query(spec.query.replace("WITH scoped AS", fixture), spec.params);
    return rows[0].analytics as DashboardAnalytics;
  }
  const all = await report({});
  assert.equal(all.total, 4);
  assert.equal(all.previous, 2);
  assert.equal(all.today, 4);
  assert.equal(all.qualified, 2);
  assert.equal(all.won, 1);
  assert.equal(all.newCount, 1);
  assert.deepEqual(all.daily, [{ date: "2026-09-18", count: 4 }]);
  assert.equal(all.hourly.length, 24);
  assert.equal(all.hourly[0].count, 1);
  assert.equal(all.hourly[23].count, 1);
  assert.equal(all.hourly.reduce((sum, hour) => sum + hour.count, 0), all.total);
  assert.equal(all.statuses.reduce((sum, status) => sum + status.count, 0), all.total);
  assert.equal((await report({ source: "direct", campaign: "(untagged)" })).total, 2);
  assert.equal((await report({ source: "google", campaign: "launch", status: "qualified" })).total, 1);
  const empty = await report({ source: "missing" });
  assert.equal(empty.total, 0);
  assert.equal(empty.daily[0].count, 0);
  assert.deepEqual(empty.campaigns, []);
  const week = await report({ range: "7d" });
  assert.equal(week.daily.length, 7);
  assert.equal(week.daily[0].count, 0);
  assert.equal(week.total, 6);
  assert.equal(week.daily.reduce((sum, day) => sum + day.count, 0), week.total);
  console.log("PASS: read-only SQL fixtures, inclusive start/exclusive end, zero-filled buckets, combined filters, direct attribution, status and hourly totals.");
}

if (process.argv.includes("--database")) {
  checkDatabase().catch((error) => { console.error(error); process.exitCode = 1; });
}
