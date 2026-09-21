"use client";

import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LeadDeleteButton } from "@/components/lead-delete-button";
import { LeadStatusControl } from "@/components/lead-status-control";
import type { LeadListItem } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export function LeadsTable({ leads, adminSlug, canDelete }: { leads: LeadListItem[]; adminSlug: string; canDelete: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const selectAll = useRef<HTMLInputElement>(null);
  const shown = leads.filter((lead) => !removed.includes(lead.id));
  const selectedLeads = shown.filter((lead) => selected.includes(lead.id));
  const allSelected = shown.length > 0 && selectedLeads.length === shown.length;
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selectedLeads.length > 0 && !allSelected;
  }, [selectedLeads.length, allSelected]);

  function onDeleted(ids: string[], message: string) {
    setRemoved((current) => [...current, ...ids]);
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    setNotice(message);
  }

  return <section className="admin-card leads-list-card">
    <header><div><span className="admin-page-kicker">RESULTS</span><h2>{shown.length} {shown.length === 1 ? "lead" : "leads"}</h2></div><Users size={22} /></header>
    {notice && <p className="lead-deletion-notice" role="status">{notice}</p>}
    {canDelete && <div className="lead-selection-toolbar">
      <div><strong>{selectedLeads.length} selected</strong><small>Select individual rows or all leads shown below (up to 250).</small></div>
      <div>{selectedLeads.length > 0 && <button type="button" className="admin-button secondary" onClick={() => setSelected([])}>Clear selection</button>}<LeadDeleteButton leads={selectedLeads} label={`Delete selected${selectedLeads.length ? ` (${selectedLeads.length})` : ""}`} onDeleted={onDeleted} /></div>
    </div>}
    <div className="admin-table-wrap">
      <table className="admin-table leads-table">
        <thead><tr>{canDelete && <th className="lead-selection-cell"><input ref={selectAll} type="checkbox" aria-label={`Select all ${shown.length} shown leads`} checked={allSelected} disabled={!shown.length} onChange={(event) => setSelected(event.target.checked ? shown.map((lead) => lead.id) : [])} /></th>}<th>Lead</th><th>Phone / email</th><th>City</th><th>Source</th><th>Received</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {shown.map((lead) => <tr key={lead.id} className={selected.includes(lead.id) ? "lead-row-selected" : undefined}>
            {canDelete && <td className="lead-selection-cell"><input type="checkbox" aria-label={`Select ${lead.name || "unnamed lead"}`} checked={selected.includes(lead.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, lead.id] : current.filter((id) => id !== lead.id))} /></td>}
            <td><strong>{lead.name || "Unnamed lead"}</strong><small>{lead.language.toUpperCase()} response</small></td><td><strong>{lead.phone || "N/A"}</strong><small>{lead.email || ""}</small></td><td>{lead.city || "N/A"}</td><td><span className="source-pill">{lead.source || "direct"}</span></td><td>{formatDate(lead.createdAt)}</td><td><LeadStatusControl key={`${lead.id}-${lead.status}`} id={lead.id} initialStatus={lead.status} /></td>
            <td><div className="lead-row-actions"><Link className="table-arrow" href={`/${adminSlug}/leads/${lead.id}`} aria-label={`View details for ${lead.name || "lead"}`}><ArrowRight size={16} /></Link>{canDelete && <LeadDeleteButton leads={[lead]} compact onDeleted={onDeleted} />}</div></td>
          </tr>)}
          {!shown.length && <tr><td colSpan={canDelete ? 8 : 7} className="empty-table"><Users size={24} /> No leads match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
