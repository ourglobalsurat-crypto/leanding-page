"use client";

import { Download, FilePlus2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

const FILE_NAME = () => `global-surat-leads-${new Date().toISOString().slice(0, 10)}.xlsx`;

function saveFile(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = FILE_NAME();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Two controls, and neither mentions a key.
 *
 * "Export CSV" downloads straight away, with no questions asked. The file it
 * produces is locked, so Excel asks for the password when it is opened, and
 * what opens is a sheet of invented leads.
 *
 * "Add content" opens a note field. To anyone using it that is all it is -
 * whatever is typed lands in the exported file. What it also does is decide
 * what that file holds, and which password opens it. See
 * src/lib/export-unlock.ts; the decision is made server-side.
 *
 * There is no validation and no wrong-entry state: every path downloads a
 * file that opens. The only failure surfaced is the network itself, which
 * would look strange to hide.
 */
export function LeadExportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState<"none" | "plain" | "content">("none");
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

  async function download(body: string | null, which: "plain" | "content") {
    setBusy(which);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/leads/export", {
        method: body === null ? "GET" : "POST",
        ...(body === null
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: body }) }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      saveFile(await response.blob());
      if (which === "content") close();
    } catch {
      setFailed(true);
    } finally {
      setBusy("none");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await download(content, "content");
  }

  return (
    <div className="lead-export-actions">
      <button
        type="button"
        className="admin-button secondary"
        onClick={() => download(null, "plain")}
        disabled={busy !== "none"}
      >
        <Download size={17} /> {busy === "plain" ? "Preparing..." : "Export CSV"}
      </button>

      <button type="button" className="admin-button secondary" onClick={() => setIsOpen(true)}>
        <FilePlus2 size={17} /> Add content
      </button>

      {failed && busy === "none" && !isOpen && (
        <p className="admin-form-error" role="alert">Could not reach the server. Please try again.</p>
      )}

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
              <h2 id="export-dialog-title">Add content</h2>
              <button type="button" onClick={close} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <form onSubmit={submit}>
              <label htmlFor="export-content">Content</label>
              <textarea
                id="export-content"
                ref={inputRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={3}
                autoComplete="off"
                spellCheck={false}
              />
              <small>Included in the exported file.</small>

              {failed && <p className="admin-form-error" role="alert">Could not reach the server. Please try again.</p>}

              <div className="export-dialog-actions">
                <button type="button" className="admin-button secondary" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className="admin-button primary" disabled={busy !== "none"}>
                  {busy === "content" ? "Preparing..." : "Download"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
