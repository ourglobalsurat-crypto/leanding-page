"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

export function LeadDeleteButton({ leads, label = "Delete lead", redirectTo, onDeleted, compact = false }: {
  leads: { id: string; name: string | null }[];
  label?: string;
  redirectTo?: string;
  onDeleted?: (ids: string[], message: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [targets, setTargets] = useState(leads);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targets.map((lead) => lead.id), confirmed: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.message || "Could not delete the selected leads.");
        return;
      }
      const count = Number(result.deletedCount);
      const message = count ? `${count} ${count === 1 ? "lead" : "leads"} permanently deleted.${count < targets.length ? " Other selected leads were already removed." : ""}` : "The selected leads were already removed.";
      dialog.current?.close();
      onDeleted?.(targets.map((lead) => lead.id), message);
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Connection interrupted. Refresh the list to check whether deletion completed before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className={compact ? "lead-delete-icon" : "admin-button danger"} disabled={!leads.length || busy} aria-label={compact ? `Delete ${leads[0]?.name || "unnamed lead"}` : undefined} onClick={() => {
      setTargets([...leads]);
      setError("");
      dialog.current?.showModal();
    }}><Trash2 size={16} />{!compact && label}</button>
    <dialog ref={dialog} className="lead-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={(event) => { if (busy) event.preventDefault(); }}>
      <div className="lead-delete-dialog-content">
        <span className="lead-delete-warning"><Trash2 size={24} /></span>
        <h2 id={titleId}>Permanently delete {targets.length === 1 ? "this lead" : `${targets.length} leads`}?</h2>
        <p id={descriptionId}>This removes the selected {targets.length === 1 ? "lead" : "leads"}, including contact details, questionnaire answers and internal notes. This cannot be undone.</p>
        <ul>{targets.slice(0, 5).map((lead) => <li key={lead.id}>{lead.name || "Unnamed lead"}</li>)}{targets.length > 5 && <li>and {targets.length - 5} more selected leads</li>}</ul>
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <div className="lead-delete-dialog-actions">
          <button type="button" className="admin-button secondary" autoFocus disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className="admin-button danger" disabled={busy} onClick={remove}>{busy ? "Deleting..." : `Delete ${targets.length} ${targets.length === 1 ? "lead" : "leads"} permanently`}</button>
        </div>
      </div>
    </dialog>
  </>;
}
