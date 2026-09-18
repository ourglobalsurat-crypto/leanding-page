import type { DashboardFilters } from "@/lib/dashboard-filters";
import type { LeadStatus } from "@/lib/types";

export type DashboardAnalytics = {
  total: number; previous: number; today: number; qualified: number; newCount: number; won: number;
  daily: { date: string; count: number }[];
  hourly: { hour: number; count: number }[];
  statuses: { status: LeadStatus; count: number }[];
  sources: { source: string; count: number; qualified: number }[];
  campaigns: { campaign: string; source: string; count: number; qualified: number; won: number }[];
};

// Shared by every report, including recent leads. Values always use SQL parameters.
export function dashboardQuery(filters: DashboardFilters) {
  const params = [filters.previousStartAt, filters.startAt, filters.endAt, filters.source, filters.campaign, filters.status];
  const scope = `created_at >= $1::timestamptz AND created_at < $3::timestamptz
    AND ($4 = '' OR coalesce(nullif(source, ''), 'direct') = $4)
    AND ($5 = '' OR coalesce(nullif(utm->>'campaign', ''), '(untagged)') = $5)
    AND ($6 = '' OR status = $6)`;
  const cte = `WITH scoped AS (
    SELECT created_at, status, coalesce(nullif(source, ''), 'direct') AS source,
      coalesce(nullif(utm->>'campaign', ''), '(untagged)') AS campaign
    FROM leads WHERE ${scope}
  ), selected AS (SELECT * FROM scoped WHERE created_at >= $2::timestamptz),
  daily_counts AS (
    SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*)::int AS count
    FROM selected GROUP BY 1
  ), hourly_counts AS (
    SELECT extract(hour FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour, count(*)::int AS count
    FROM selected GROUP BY 1
  )`;
  const query = `${cte}
  SELECT json_build_object(
    'total', (SELECT count(*)::int FROM selected),
    'previous', (SELECT count(*)::int FROM scoped WHERE created_at < $2::timestamptz),
    'today', (SELECT count(*)::int FROM selected WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = $7::date),
    'qualified', (SELECT count(*)::int FROM selected WHERE status IN ('qualified', 'won')),
    'newCount', (SELECT count(*)::int FROM selected WHERE status = 'new'),
    'won', (SELECT count(*)::int FROM selected WHERE status = 'won'),
    'daily', (SELECT coalesce(json_agg(d ORDER BY d.date), '[]'::json) FROM (
      SELECT to_char(day, 'YYYY-MM-DD') AS date, coalesce(c.count, 0) AS count
      FROM generate_series(($2::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::timestamp,
        ($3::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::timestamp - interval '1 day', interval '1 day') AS days(day)
      LEFT JOIN daily_counts c USING (day)
    ) d),
    'hourly', (SELECT json_agg(h ORDER BY h.hour) FROM (
      SELECT hour, coalesce(c.count, 0) AS count FROM generate_series(0, 23) AS hours(hour)
      LEFT JOIN hourly_counts c USING (hour)
    ) h),
    'statuses', (SELECT coalesce(json_agg(s), '[]'::json) FROM (
      SELECT status, count(*)::int AS count FROM selected GROUP BY status
    ) s),
    'sources', (SELECT coalesce(json_agg(s ORDER BY s.count DESC, s.source), '[]'::json) FROM (
      SELECT source, count(*)::int AS count, count(*) FILTER (WHERE status IN ('qualified', 'won'))::int AS qualified
      FROM selected GROUP BY source ORDER BY count DESC, source LIMIT 6
    ) s),
    'campaigns', (SELECT coalesce(json_agg(c ORDER BY c.count DESC, c.campaign, c.source), '[]'::json) FROM (
      SELECT campaign, source, count(*)::int AS count,
        count(*) FILTER (WHERE status IN ('qualified', 'won'))::int AS qualified,
        count(*) FILTER (WHERE status = 'won')::int AS won
      FROM selected GROUP BY campaign, source ORDER BY count DESC, campaign, source LIMIT 10
    ) c)
  ) AS analytics`;
  return { query, params: [...params, filters.today], scope, scopeParams: params };
}
