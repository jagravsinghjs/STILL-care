import { ChevronRight, History, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SavedSession } from '../../patient/service';
import { distressStatus, sessionDate } from '../../patient/distress';

export type HistoryState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; sessions: SavedSession[] };

export function DistressStatus({ score }: { score: number | null }) {
  const { tone, label } = distressStatus(score);
  return <span className={`distress-status distress-status--${tone}`}><span className="distress-dot" aria-hidden="true" />{label}</span>;
}

export default function SessionHistory({ state, selected, onSelect, onRefresh }: {
  state: HistoryState; selected: string | null; onSelect: (id: string) => void; onRefresh: () => void;
}) {
  return <section className="history-panel" aria-labelledby="history-heading">
    <div className="history-heading"><h1 id="history-heading"><History aria-hidden="true" />Your History</h1>
      <Link to="/patient/session/new" className="new-session"><Plus size={22} aria-hidden="true" />New Session</Link>
    </div>
    {state.status === 'loading' && <div className="history-feedback" role="status"><RefreshCw className="spinner" size={22} aria-hidden="true" /><p>Loading your sessions…</p></div>}
    {state.status === 'error' && <div className="history-feedback"><p role="alert">{state.message}</p><button className="quiet-button" onClick={onRefresh}><RefreshCw size={17} aria-hidden="true" />Try Again</button></div>}
    {state.status === 'ready' && <>
      {state.sessions.length === 0 ? <div className="history-feedback history-empty"><p>No sessions yet.</p><span>Your conversations will appear here after your first session.</span></div> :
        <ul className="session-list" aria-label="Saved sessions">{state.sessions.map((session, index) => <li key={session.id}>
          <button className={`session-entry${selected === session.id ? ' session-entry--selected' : ''}`} onClick={() => onSelect(session.id)} aria-pressed={selected === session.id}>
            <span className="session-bubble"><MessageCircle aria-hidden="true" /></span>
            <span className="session-description"><strong>Session {state.sessions.length - index}</strong><time dateTime={session.started_at}>{sessionDate(session.started_at)}</time>{!session.ended_at && <small>Not completed</small>}</span>
            <DistressStatus score={session.ended_at ? session.mean_score : null} /><ChevronRight className="session-chevron" size={21} aria-hidden="true" />
          </button>
        </li>)}</ul>}
      <button className="quiet-button history-refresh" onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" />Refresh history</button>
      {state.sessions.length > 0 && <p className="signal-note">Model-generated support signals, not diagnoses. Low distress does not guarantee safety.</p>}
    </>}
  </section>;
}
