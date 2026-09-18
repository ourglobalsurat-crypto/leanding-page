import { ArrowRight, Clock3, Target, TrendingUp, Users } from "lucide-react";
import Link from "next/link";

import { LeadStatusControl } from "@/components/lead-status-control";
import { DashboardFilterBar } from "@/components/dashboard-filters";
import { DashboardActivity } from "@/components/dashboard-activity";
import { getDashboardData } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";
import { assertValidAdminSlug } from "@/lib/admin-routes";
import { displayDay, parseDashboardFilters, periodChange, statusLabels, type DashboardSearch } from "@/lib/dashboard-filters";
import { leadStatuses } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
const number = (value: number) => value.toLocaleString("en-IN");
const rate = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : "N/A";

export default async function AdminOverviewPage({ params, searchParams }: {
  params: Promise<{ adminSlug: string }>;
  searchParams: Promise<DashboardSearch>;
}) {
  const { adminSlug } = await params;
  assertValidAdminSlug(adminSlug);
  await requireAdmin(adminSlug);
  const filters = parseDashboardFilters(await searchParams);
  const data = await getDashboardData(filters);
  const stats = data.analytics;
  const peak = stats.daily.reduce((best, day) => day.count > best.count ? day : best, stats.daily[0]);
  const colors = ["#f26937", "#4779c4", "#749334", "#242820", "#a9a99f"];
  const statuses = leadStatuses.map((status, index) => ({ status, color: colors[index], count: stats.statuses.find((item) => item.status === status)?.count ?? 0 }));
  let angle = 0;
  const gradient = statuses.map((item) => {
    const start = angle;
    angle += stats.total ? item.count / stats.total * 360 : 0;
    return `${item.color} ${start}deg ${angle}deg`;
  }).join(", ");

  return (
    <main className="admin-page dashboard-page">
      <div className="admin-page-heading">
        <div><span className="admin-page-kicker">PERFORMANCE OVERVIEW</span><h1>Lead pulse</h1><p>See what brings leads in, and where to focus next.</p></div>
        <Link className="admin-button primary" href={`/${adminSlug}/leads`}>View all leads <ArrowRight size={17} /></Link>
      </div>

      <DashboardFilterBar key={JSON.stringify(filters)} filters={filters} options={data.options} />
      {filters.warning && <p className="admin-notice error" role="alert">{filters.warning}</p>}
      <div className="dashboard-period"><strong>{displayDay(filters.start)}{filters.start !== filters.end && ` to ${displayDay(filters.end)}`}</strong><span>{filters.days} {filters.days === 1 ? "day" : "days"} | All reports use the selected filters{filters.end === filters.today ? " | Today is still in progress" : ""}</span></div>

      <section className="admin-stat-grid dashboard-stats" aria-label="Performance metrics">
        <article><span className="stat-icon orange"><Users /></span><div><small>Leads in period</small><strong>{number(stats.total)}</strong><em className={stats.total > stats.previous ? "dashboard-positive" : ""}>{periodChange(stats.total, stats.previous)}</em></div></article>
        <article><span className="stat-icon lime"><Clock3 /></span><div><small>Today&apos;s leads</small><strong>{filters.end === filters.today ? number(stats.today) : "N/A"}</strong><em>{filters.end === filters.today ? "Since midnight IST | filtered" : "Today is outside this date range"}</em></div></article>
        <article><span className="stat-icon blue"><TrendingUp /></span><div><small>Awaiting action</small><strong>{number(stats.newCount)}</strong><em>Selected leads still marked new</em></div></article>
        <article><span className="stat-icon dark"><Target /></span><div><small>Qualification rate</small><strong>{rate(stats.qualified, stats.total)}</strong><em>{number(stats.qualified)} qualified or won / {number(stats.total)} leads</em></div></article>
      </section>
      <p className="dashboard-comparison">Compared with {displayDay(filters.previousStart)} to {displayDay(filters.previousEnd)} ({number(stats.previous)} leads), using the same source, campaign, and status filters. {filters.end === filters.today && "The previous period contains complete days; this period includes today so far."}</p>

      <section className="dashboard-insights" aria-label="Performance highlights">
        <div><span>Daily average</span><strong>{(stats.total / filters.days).toFixed(1)} <small>leads / calendar day</small></strong></div>
        <div><span>Peak day</span><strong>{peak.count ? displayDay(peak.date) : "No activity yet"} <small>{peak.count ? `${number(peak.count)} leads${stats.daily.filter((day) => day.count === peak.count).length > 1 ? " | joint highest" : ""}` : ""}</small></strong></div>
        <div><span>Top source by volume</span><strong>{stats.sources[0]?.source || "No source data"} <small>{stats.sources[0] ? `${rate(stats.sources[0].count, stats.total)} of leads` : ""}</small></strong></div>
      </section>

      <section className="admin-overview-grid dashboard-main-charts">
        <DashboardActivity key={`${filters.start}-${filters.end}`} daily={stats.daily} hourly={stats.hourly} singleDay={filters.days === 1} />
        <article className="admin-card dashboard-quality">
          <header><div><span className="admin-page-kicker">LEAD QUALITY</span><h2>Status breakdown</h2></div></header>
          <div className="dashboard-donut" style={{ background: stats.total ? `conic-gradient(${gradient})` : "#e9ebe4" }} role="img" aria-label={`Status breakdown: ${statuses.map((item) => `${statusLabels[item.status]} ${item.count}`).join(", ")}`}><div><strong>{number(stats.total)}</strong><span>leads</span></div></div>
          <ul className="dashboard-status-legend">{statuses.map((item) => <li key={item.status}><span><i style={{ background: item.color }} />{statusLabels[item.status]}</span><strong>{number(item.count)} <small>{rate(item.count, stats.total)}</small></strong></li>)}</ul>
          <p className="dashboard-chart-note">Current status of leads received in this period, not a history of stage changes.</p>
        </article>
      </section>

      <section className="dashboard-attribution-grid">
        <article className="admin-card dashboard-sources"><header><div><span className="admin-page-kicker">CHANNEL MIX</span><h2>Top sources</h2></div><span className="dashboard-header-note">Top 6 by leads</span></header>
          <div className="dashboard-source-list">{stats.sources.length ? stats.sources.map((item, index) => <div key={item.source}>
            <div><strong title={item.source}>{item.source}</strong><span>{number(item.count)} <small> / {rate(item.count, stats.total)}</small></span></div>
            <div className="dashboard-source-track"><span style={{ width: `${item.count / stats.total * 100}%`, background: colors[index % colors.length] }} /></div>
            <small>{rate(item.qualified, item.count)} qualified or won</small>
          </div>) : <p className="dashboard-empty-copy">No sources match these filters.</p>}</div>
        </article>
        <article className="admin-card dashboard-campaigns"><header><div><span className="admin-page-kicker">CAMPAIGN PERFORMANCE</span><h2>Which campaigns deliver?</h2></div><span className="dashboard-header-note">Top 10 by leads</span></header>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign / source</th><th>Leads</th><th>Qualified + won</th><th>Won</th><th>Quality rate</th></tr></thead><tbody>{stats.campaigns.map((item) => <tr key={JSON.stringify([item.campaign, item.source])}><td><strong>{item.campaign === "(untagged)" ? "No campaign tag" : item.campaign}</strong><small>{item.source}</small></td><td>{number(item.count)}</td><td>{number(item.qualified)}</td><td>{number(item.won)}</td><td><span className="dashboard-rate-pill">{rate(item.qualified, item.count)}</span></td></tr>)}{!stats.campaigns.length && <tr><td colSpan={5} className="empty-table">No campaign data for this selection.</td></tr>}</tbody></table></div>
          <p className="dashboard-chart-note">Campaigns use the captured UTM campaign tag. Quality rate = qualified or won / leads. Ad spend and visitor data are not tracked here.</p>
        </article>
      </section>

      <section className="admin-card recent-leads-card">
        <header><div><span className="admin-page-kicker">LATEST MATCHING ENQUIRIES</span><h2>Recent leads</h2></div><Link href={`/${adminSlug}/leads`}>Open lead desk <ArrowRight size={15} /></Link></header>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Lead</th><th>Contact</th><th>City</th><th>Received</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.recent.map((lead) => <tr key={lead.id}><td><strong>{lead.name || "Unnamed lead"}</strong><small>{lead.source || "direct"}</small></td><td><strong>{lead.phone || lead.email || "N/A"}</strong><small>{lead.language.toUpperCase()}</small></td><td>{lead.city || "N/A"}</td><td>{formatDate(lead.createdAt)}</td><td><LeadStatusControl key={`${lead.id}-${lead.status}`} id={lead.id} initialStatus={lead.status} /></td><td><Link className="table-arrow" href={`/${adminSlug}/leads/${lead.id}`} aria-label={`View ${lead.name || "lead"}`}><ArrowRight size={16} /></Link></td></tr>)}
              {!data.recent.length && <tr><td colSpan={6} className="empty-table">No leads match these filters. Try a wider date range or reset the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
