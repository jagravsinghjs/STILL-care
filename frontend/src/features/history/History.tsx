import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { useApp } from "../../store/useApp";
import { request } from "../../api/client";
import { dateLabel } from "../../utils/date";
import { Card } from "../../components/ui";

export function History() {
  const entries = useApp((s) => s.reports);
  const [open, setOpen] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  async function toggle(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id); setError("");
    if (!reports[id]) {
      try { const report = await request(`/api/patients/me/sessions/${id}/report`); setReports((current) => ({ ...current, [id]: report })); }
      catch (e) { setError(e instanceof Error ? e.message : "Unable to load this report."); }
    }
  }
  return <>
    <div className="eyebrow">YOUR CONTINUITY</div><h1>Your history</h1><p className="lead">Review your previous processed sessions and reports.</p>
    <Card><div className="section-heading"><h2>Your sessions</h2><span>Most recent first</span></div>
      {!entries.length && <p className="muted">No completed sessions yet.</p>}
      {entries.map((entry) => <article className="history-item" key={entry.id}><span className="tile-icon lavender"><FileText size={19} /></span><div className="grow"><div className="muted small-text">{dateLabel(entry.created_at)} · {entry.summary}</div><button className="text-link" aria-expanded={open === entry.id} onClick={() => toggle(entry.id)}>{open === entry.id ? "Hide report" : "View report"}<ChevronDown size={15} /></button>{open === entry.id && <div className="private-detail"><pre className="reflection-text">{JSON.stringify(reports[entry.id] ?? {}, null, 2)}</pre><small>Your report is private to you.</small></div>}</div></article>)}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Card>
  </>;
}
