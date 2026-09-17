import { ArrowRight, Search, Users } from "lucide-react";
import Link from "next/link";

import { LeadExportDialog } from "@/components/lead-export-dialog";
import { LeadStatusControl } from "@/components/lead-status-control";
import { getLeads } from "@/lib/admin-data";
import { leadStatuses } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export default async function LeadsPage({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ adminSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { adminSlug } = await paramsPromise;
  const params = await searchParams;
  const leads = await getLeads({ search: params.q, status: params.status });

  return (
    <main className="admin-page">
      <div className="admin-page-heading">
        <div><span className="admin-page-kicker">LEAD MANAGEMENT</span><h1>All leads</h1><p>Search, qualify and follow up with every landing-page enquiry.</p></div>
        <LeadExportDialog />
      </div>

      <form className="lead-filters" method="get">
        <label><Search size={17} /><input name="q" defaultValue={params.q || ""} placeholder="Search name, phone, email or city" /></label>
        <select name="status" defaultValue={params.status || ""} aria-label="Filter by status"><option value="">All statuses</option>{leadStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
        <button type="submit">Apply filters</button>
        {(params.q || params.status) && <Link href={`/${adminSlug}/leads`}>Clear</Link>}
      </form>

      <section className="admin-card leads-list-card">
        <header><div><span className="admin-page-kicker">RESULTS</span><h2>{leads.length} {leads.length === 1 ? "lead" : "leads"}</h2></div><Users size={22} /></header>
        <div className="admin-table-wrap">
          <table className="admin-table leads-table">
            <thead><tr><th>Lead</th><th>Phone / email</th><th>City</th><th>Source</th><th>Received</th><th>Status</th><th /></tr></thead>
            <tbody>
              {leads.map((lead) => <tr key={lead.id}><td><strong>{lead.name || "Unnamed lead"}</strong><small>{lead.language.toUpperCase()} response</small></td><td><strong>{lead.phone || "—"}</strong><small>{lead.email || ""}</small></td><td>{lead.city || "—"}</td><td><span className="source-pill">{lead.source || "direct"}</span></td><td>{formatDate(lead.createdAt)}</td><td><LeadStatusControl id={lead.id} initialStatus={lead.status} /></td><td><Link className="table-arrow" href={`/${adminSlug}/leads/${lead.id}`} aria-label={`View details for ${lead.name || "lead"}`}><ArrowRight size={16} /></Link></td></tr>)}
              {!leads.length && <tr><td colSpan={7} className="empty-table"><Users size={24} /> No leads match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
