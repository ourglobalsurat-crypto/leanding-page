"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { displayDay } from "@/lib/dashboard-filters";
import type { DashboardAnalytics } from "@/lib/dashboard-query";

export function DashboardActivity({ daily, hourly, singleDay }: Pick<DashboardAnalytics, "daily" | "hourly"> & { singleDay: boolean }) {
  const [view, setView] = useState(singleDay ? "hourly" : "daily");
  const points = view === "daily" ? daily.map((item) => ({
    key: item.date, label: displayDay(item.date).replace(/ \d{4}$/, ""), full: displayDay(item.date), count: item.count,
  })) : hourly.map((item) => ({
    key: String(item.hour), label: `${String(item.hour).padStart(2, "0")}:00`, full: `${String(item.hour).padStart(2, "0")}:00–${String(item.hour).padStart(2, "0")}:59 IST`, count: item.count,
  }));
  const max = Math.max(1, ...points.map((point) => point.count));
  const total = points.reduce((sum, point) => sum + point.count, 0);
  return <article className="admin-card dashboard-activity">
    <header><div><span className="admin-page-kicker">LEAD VOLUME</span><h2>When leads come in</h2></div><div className="dashboard-chart-toggle" aria-label="Chart grouping"><button type="button" aria-pressed={view === "daily"} onClick={() => setView("daily")}>Daily</button><button type="button" aria-pressed={view === "hourly"} onClick={() => setView("hourly")}>Hourly</button></div></header>
    <div className="dashboard-chart-caption"><span><i /> {view === "daily" ? "Leads per day" : "Leads by hour of day"}</span><span>{total.toLocaleString("en-IN")} leads · IST</span></div>
    {!total ? <div className="dashboard-chart-empty"><BarChart3 size={35} /><strong>No leads in this selection</strong><p>Try a wider date range or clear your source, campaign, or status filters.</p></div> : <div className="dashboard-chart-scroll" tabIndex={0} aria-label="Lead volume chart. Scroll to see all dates.">
      <div className="dashboard-bars" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(38px, 1fr))` }}>
        {points.map((point) => <div className="dashboard-bar-column" key={point.key}>
          <div className="dashboard-bar-track"><button type="button" className="dashboard-bar" style={{ height: `${point.count / max * 100}%` }} aria-label={`${point.full}: ${point.count} leads`}><span className="dashboard-bar-tooltip">{point.full}<br />{point.count} {point.count === 1 ? "lead" : "leads"}</span><span className="dashboard-bar-count">{point.count}</span></button></div>
          <span className="dashboard-bar-label">{point.label}</span>
        </div>)}
      </div>
    </div>}
    <p className="dashboard-chart-note">{view === "daily" ? "Each bar is one calendar day. Hover or focus a bar for its exact count." : "Hours combine all selected days. Useful for planning follow-up coverage."}</p>
    <details className="dashboard-data-table"><summary>View chart data</summary><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{view === "daily" ? "Date" : "Hour (IST)"}</th><th>Leads</th></tr></thead><tbody>{points.map((point) => <tr key={point.key}><td>{point.full}</td><td>{point.count}</td></tr>)}</tbody></table></div></details>
  </article>;
}
