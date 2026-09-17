import { ArrowRight, Clock3, Target, TrendingUp, UserRoundCheck, Users } from "lucide-react";
import Link from "next/link";

import { LeadStatusControl } from "@/components/lead-status-control";
import { getDashboardData } from "@/lib/admin-data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const data = await getDashboardData();
  const maxDaily = Math.max(...data.daily.map((item) => item.count), 1);

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div><span className="admin-page-kicker">OVERVIEW</span><h1>Lead pulse</h1><p>A quick view of new enquiries and team follow-up.</p></div>
        <Link className="admin-button primary" href={`/${adminSlug}/leads`}>View all leads <ArrowRight size={17} /></Link>
      </div>

      <section className="admin-stat-grid">
        <article><span className="stat-icon orange"><Users /></span><div><small>Total leads</small><strong>{data.stats.total}</strong><em>All time</em></div></article>
        <article><span className="stat-icon lime"><Clock3 /></span><div><small>Last 24 hours</small><strong>{data.stats.today}</strong><em>Fresh enquiries</em></div></article>
        <article><span className="stat-icon blue"><TrendingUp /></span><div><small>Awaiting action</small><strong>{data.stats.newCount}</strong><em>Marked as new</em></div></article>
        <article><span className="stat-icon dark"><UserRoundCheck /></span><div><small>Qualified / won</small><strong>{data.stats.qualified}</strong><em>Promising leads</em></div></article>
      </section>

      <section className="admin-overview-grid">
        <article className="admin-card chart-card">
          <header><div><span className="admin-page-kicker">LAST 7 DAYS</span><h2>Lead activity</h2></div><Target size={22} /></header>
          <div className="bar-chart" aria-label="Lead activity for the last seven days">
            {data.daily.map((item) => (
              <div key={item.label}><span className="bar-value">{item.count}</span><span className="bar" style={{ height: `${Math.max((item.count / maxDaily) * 100, 5)}%` }} /><small>{item.label}</small></div>
            ))}
          </div>
        </article>
        <article className="admin-card source-card">
          <header><div><span className="admin-page-kicker">ATTRIBUTION</span><h2>Top sources</h2></div></header>
          <div className="source-list">
            {data.sources.length ? data.sources.map((item, index) => <div key={item.source}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.source}</strong><em>{item.count}</em></div>) : <p>No source data yet.</p>}
          </div>
        </article>
      </section>

      <section className="admin-card recent-leads-card">
        <header><div><span className="admin-page-kicker">LATEST ENQUIRIES</span><h2>Recent leads</h2></div><Link href={`/${adminSlug}/leads`}>See all <ArrowRight size={15} /></Link></header>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Lead</th><th>Contact</th><th>City</th><th>Received</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.recent.map((lead) => <tr key={lead.id}><td><strong>{lead.name || "Unnamed lead"}</strong><small>{lead.source || "direct"}</small></td><td><strong>{lead.phone || lead.email || "—"}</strong><small>{lead.language.toUpperCase()}</small></td><td>{lead.city || "—"}</td><td>{formatDate(lead.createdAt)}</td><td><LeadStatusControl id={lead.id} initialStatus={lead.status} /></td><td><Link className="table-arrow" href={`/${adminSlug}/leads/${lead.id}`} aria-label={`View ${lead.name || "lead"}`}><ArrowRight size={16} /></Link></td></tr>)}
              {!data.recent.length && <tr><td colSpan={6} className="empty-table">No leads yet. New form submissions will appear here.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
