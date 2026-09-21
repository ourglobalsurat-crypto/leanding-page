import { Search } from "lucide-react";
import Link from "next/link";

import { LeadExportDialog } from "@/components/lead-export-dialog";
import { LeadsTable } from "@/components/leads-table";
import { requireAdmin } from "@/lib/auth";
import { assertValidAdminSlug } from "@/lib/admin-routes";
import { getLeads } from "@/lib/admin-data";
import { leadStatuses } from "@/lib/types";

export default async function LeadsPage({
  params: paramsPromise,
  searchParams,
}: {
  params: Promise<{ adminSlug: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { adminSlug } = await paramsPromise;
  assertValidAdminSlug(adminSlug);
  const admin = await requireAdmin(adminSlug);
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

      <LeadsTable key={JSON.stringify([params.q || "", params.status || ""])} leads={leads} adminSlug={adminSlug} canDelete={admin.role === "owner" || admin.role === "editor"} />
    </main>
  );
}
