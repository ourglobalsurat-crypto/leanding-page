import { ArrowLeft, CalendarClock, Link2, Mail, MapPin, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LeadNoteForm } from "@/components/lead-note-form";
import { LeadStatusControl } from "@/components/lead-status-control";
import { getLeadDetail } from "@/lib/admin-data";
import type { LeadAnswer } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function displayAnswer(item: LeadAnswer) {
  const options = item.questionSnapshot.options ?? [];
  const resolve = (value: unknown) => {
    const option = options.find((candidate) => candidate.id === value);
    return option?.label.en || String(value ?? "—");
  };
  return Array.isArray(item.answer) ? item.answer.map(resolve).join(", ") : resolve(item.answer);
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ adminSlug: string; id: string }>;
}) {
  const { adminSlug, id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();
  const whatsappDigits = lead.phone?.replace(/\D/g, "");

  return (
    <main className="admin-page">
      <Link className="admin-back-link" href={`/${adminSlug}/leads`}><ArrowLeft size={16} /> Back to all leads</Link>
      <div className="lead-detail-heading">
        <div><span className="admin-page-kicker">LEAD DETAIL</span><h1>{lead.name || "Unnamed lead"}</h1><p>Received {formatDate(lead.createdAt)}</p></div>
        <LeadStatusControl id={lead.id} initialStatus={lead.status} />
      </div>

      <div className="lead-detail-grid">
        <div className="lead-detail-main">
          <section className="admin-card lead-answer-card">
            <header><div><span className="admin-page-kicker">QUESTIONNAIRE</span><h2>Lead answers</h2></div></header>
            <div className="answer-list">
              {lead.answers.map((answer, index) => <article key={answer.id}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{answer.questionSnapshot.label.en || answer.questionKey}</h3><p>{displayAnswer(answer)}</p></div></article>)}
            </div>
          </section>
          <section className="admin-card notes-card">
            <header><div><span className="admin-page-kicker">TEAM NOTES</span><h2>Follow-up history</h2></div></header>
            <LeadNoteForm leadId={lead.id} />
            <div className="notes-list">
              {lead.notes.map((note) => <article key={note.id}><p>{note.note}</p><small>{note.adminEmail} · {formatDate(note.createdAt)}</small></article>)}
              {!lead.notes.length && <p className="empty-notes">No internal notes yet.</p>}
            </div>
          </section>
        </div>

        <aside className="lead-detail-side">
          <section className="admin-card contact-card">
            <span className="admin-page-kicker">CONTACT</span>
            {lead.phone && <a href={`tel:${lead.phone}`}><Phone size={17} /><span><small>Phone</small><strong>{lead.phone}</strong></span></a>}
            {whatsappDigits && <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noreferrer"><MessageCircle size={17} /><span><small>WhatsApp</small><strong>Open conversation</strong></span></a>}
            {lead.email && <a href={`mailto:${lead.email}`}><Mail size={17} /><span><small>Email</small><strong>{lead.email}</strong></span></a>}
            <div><MapPin size={17} /><span><small>City</small><strong>{lead.city || "Not shared"}</strong></span></div>
            <div><CalendarClock size={17} /><span><small>Received</small><strong>{formatDate(lead.createdAt)}</strong></span></div>
          </section>
          <section className="admin-card attribution-card">
            <span className="admin-page-kicker">ATTRIBUTION</span>
            <dl><div><dt>Source</dt><dd>{lead.source || "direct"}</dd></div>{Object.entries(lead.utm).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
            {lead.referrer && <p><Link2 size={14} /> {lead.referrer}</p>}
          </section>
          <section className="privacy-confirm"><ShieldCheck size={18} /><span><strong>Contact consent recorded</strong><small>{formatDate(lead.consentAt)}</small></span></section>
        </aside>
      </div>
    </main>
  );
}
