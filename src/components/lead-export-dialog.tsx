"use client";

import { Download, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

/**
 * The export dialog. To anyone using it, this is a note field: type something,
 * it ends up in the downloaded file. What the server also does with that text
 * is decide whether the file holds the real leads or invented ones — see
 * src/lib/export-unlock.ts.
 *
 * Nothing here hints at that. No "passphrase" label, no validation, no error
 * state for a wrong entry: every submission downloads a file and closes the
 * dialog the same way. The only failure this surfaces is the network itself
 * going wrong, which would look odd to hide.
 */
export function LeadExportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  function close() {
    setIsOpen(false);
    setContent("");
    setFailed(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsWorking(true);
    setFailed(false);

    try {
      const response = await fetch("/api/admin/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        setFailed(true);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `global-surat-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      close();
    } catch {
      setFailed(true);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
      <button type="button" className="admin-button secondary" onClick={() => setIsOpen(true)}>
        <Download size={17} /> Export CSV
      </button>

      {isOpen && (
        <div className="export-dialog-backdrop" role="presentation" onClick={close}>
          <div
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="export-dialog-title">Export leads</h2>
              <button type="button" onClick={close} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <form onSubmit={submit}>
              <label htmlFor="export-content">Add content</label>
              <textarea
                id="export-content"
                ref={inputRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={3}
                autoComplete="off"
                spellCheck={false}
              />
              <small>Optional. Included in the exported file.</small>

              {failed && <p className="admin-form-error" role="alert">Could not reach the server. Please try again.</p>}

              <div className="export-dialog-actions">
                <button type="button" className="admin-button secondary" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className="admin-button primary" disabled={isWorking}>
                  {isWorking ? "Preparing..." : "Download"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
