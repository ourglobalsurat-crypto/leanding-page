"use client";

import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dashboardPresets, statusLabels, type DashboardFilters } from "@/lib/dashboard-filters";
import { leadStatuses } from "@/lib/types";

export function DashboardFilterBar({ filters, options }: {
  filters: DashboardFilters; options: { sources: string[]; campaigns: string[] };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [range, setRange] = useState(filters.range);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return <section className="admin-card dashboard-filters" aria-label="Dashboard filters" aria-busy={pending}>
    <div className="dashboard-filter-heading"><span><SlidersHorizontal size={17} /> Filter your performance</span><small>India Standard Time (UTC+05:30)</small></div>
    <form onSubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const from = String(values.get("start") || ""), to = String(values.get("end") || "");
      if (range === "custom" && (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 >= 90)) {
        setError("Choose an end date on or after the start date, within a 90-day range.");
        return;
      }
      setError("");
      const query = new URLSearchParams();
      for (const [key, value] of values) if (value && (range === "custom" || !["start", "end"].includes(key))) query.set(key, String(value));
      startTransition(() => { router.push(`${pathname}?${query}`); router.refresh(); });
    }}>
      <fieldset disabled={pending}>
        <label>Date range<select aria-label="Date range" name="range" value={range} onChange={(event) => setRange(event.target.value)}>{dashboardPresets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {range === "custom" && <>
          <label>From<input type="date" name="start" required min="2000-01-01" max={filters.today} defaultValue={filters.start} /></label>
          <label>To<input type="date" name="end" required min="2000-01-01" max={filters.today} defaultValue={filters.end} /></label>
        </>}
        <label>Source<select aria-label="Source" name="source" defaultValue={filters.source}><option value="">All sources</option>{Array.from(new Set([...options.sources, ...(filters.source ? [filters.source] : [])])).map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
        <label>Campaign<select aria-label="Campaign" name="campaign" defaultValue={filters.campaign}><option value="">All campaigns</option>{Array.from(new Set([...options.campaigns, ...(filters.campaign ? [filters.campaign] : [])])).map((campaign) => <option key={campaign} value={campaign}>{campaign === "(untagged)" ? "No campaign tag" : campaign}</option>)}</select></label>
        <label>Status<select aria-label="Status" name="status" defaultValue={filters.status}><option value="">All statuses</option>{leadStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <button className="admin-button primary" type="submit">{pending ? "Updating..." : "Apply filters"}</button>
        <button className="dashboard-reset" type="button" onClick={(event) => {
          event.currentTarget.form?.reset();
          setRange("7d");
          setError("");
          startTransition(() => router.push(pathname));
        }}>Reset</button>
        <button className="dashboard-refresh" type="button" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={() => startTransition(() => router.refresh())}><RefreshCw size={17} /></button>
      </fieldset>
      {error && <p className="dashboard-filter-error" role="alert">{error}</p>}
      <span className="dashboard-sr-only" role="status">{pending ? "Updating dashboard" : "Dashboard ready"}</span>
    </form>
  </section>;
}
