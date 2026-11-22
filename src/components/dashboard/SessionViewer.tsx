import { useEffect, useState } from 'react';
import { FileText, MessageSquareText, RefreshCw } from 'lucide-react';
import { patientService, type SessionDetail } from '../../patient/service';
import { sessionDate } from '../../patient/distress';
import { DistressStatus } from './SessionHistory';

function SavedGraph({ session }: { session: SessionDetail }) {
  const [failed, setFailed] = useState(false);
  const points = session.report?.timeline ?? [];
  const end = Math.max(1, ...points.map((point) => point.seconds));
  const xy = (point: { seconds: number; score: number }) => `${45 + point.seconds / end * 500},${190 - point.score / 10 * 160}`;
  if (session.graph_available && !failed) return <figure className="saved-graph"><img src={patientService.graphUrl(session.id)} alt="Saved session distress graph, on a scale from 0 to 10" onError={() => setFailed(true)} /><figcaption>Saved conversation-model graph · 0–10</figcaption></figure>;
  if (!points.length) return <p className="muted">{failed ? 'The saved graph could not be loaded.' : 'No distress graph is available for this session.'}</p>;
  return <figure className="saved-graph">
    <svg viewBox="0 0 580 235" role="img" aria-label="Distress over time, using saved conversation-model scores from 0 to 10">
      {[0, 5, 10].map((value) => <g key={value}><line x1="45" x2="545" y1={190 - value * 16} y2={190 - value * 16} stroke="#dae7d5" /><text x="18" y={195 - value * 16}>{value}</text></g>)}
      <polyline points={points.map(xy).join(' ')} fill="none" stroke="#389b35" strokeWidth="2.5" />
      {points.map((point, index) => { const [cx, cy] = xy(point).split(','); return <circle key={index} cx={cx} cy={cy} r="4" fill="#08752b"><title>{point.seconds} seconds: {point.score}/10</title></circle>; })}
      <text x="45" y="214">0s</text><text x="545" y="214" textAnchor="end">{end}s</text>
    </svg>
    <figcaption>Distress over time · Saved conversation-model scores (0–10)</figcaption>
    <details><summary>View graph values</summary><table><thead><tr><th>Time into session</th><th>Score / 10</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><td>{point.seconds}s</td><td>{point.score}</td></tr>)}</tbody></table></details>
  </figure>;
}

export default function SessionViewer({ selectedId, emptyHistory, onExpired }: { selectedId: string | null; emptyHistory: boolean; onExpired: () => void }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: SessionDetail }>({ status: 'loading' });
  const [view, setView] = useState<'conversation' | 'report'>('conversation');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setState({ status: 'loading' }); setView('conversation');
    patientService.detail(selectedId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState({ status: 'ready', data });
    }).catch((error) => {
      if (!controller.signal.aborted) {
        if (error.status === 401) onExpired();
        setState({ status: 'error', message: error.message });
      }
    });
    return () => controller.abort();
  }, [selectedId, attempt, onExpired]);
  if (!selectedId) return <section className="session-viewer viewer-empty" aria-label="Session viewer"><MessageSquareText size={68} strokeWidth={1.25} aria-hidden="true" />
    <h2>{emptyHistory ? 'Your journey starts here.' : 'Select a session'}</h2><p>{emptyHistory ? "Start a new session whenever you're ready." : 'View your conversation, distress summary and report here.'}</p></section>;
  // Prevent a previous session's contents flashing while a new fetch starts.
  if (state.status === 'loading' || (state.status === 'ready' && state.data.id !== selectedId)) return <section className="session-viewer viewer-empty" role="status"><RefreshCw className="spinner" size={28} aria-hidden="true" /><p>Loading your session…</p></section>;
  if (state.status === 'error') return <section className="session-viewer viewer-empty"><p role="alert">{state.message}</p><button className="quiet-button" onClick={() => setAttempt(attempt + 1)}>Try Again</button></section>;
  const session = state.data;
  return <section className="session-viewer viewer-detail" aria-label="Selected session">
    <div className="viewer-heading"><div><h2>Your session</h2><time dateTime={session.started_at}>{sessionDate(session.started_at)}</time></div><DistressStatus score={session.ended_at ? session.mean_score : null} /></div>
    <div className="viewer-switch" role="group" aria-label="Session view">
      <button aria-pressed={view === 'conversation'} onClick={() => setView('conversation')}><MessageSquareText size={18} aria-hidden="true" />Conversation</button>
      <button aria-pressed={view === 'report'} onClick={() => setView('report')}><FileText size={18} aria-hidden="true" />Report</button>
    </div>
    <div className="viewer-scroll" key={session.id}>
      {view === 'conversation' ? <>
        {!session.conversation_complete && session.messages.length > 0 && <p className="conversation-note">Some assistant replies are unavailable. Your saved words are shown below.</p>}
        {session.messages.length === 0 ? <p className="muted">No conversation has been saved for this session.</p> : <ol className="conversation">{session.messages.map((message) => <li className={`message message--${message.role}`} key={message.id}><strong>{message.role === 'patient' ? 'You' : 'STILL-care'}</strong><p>{message.text}</p>{message.timestamp && <time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>}</li>)}</ol>}
      </> : <div className="session-report">
        <h3>Distress summary</h3>
        <p>{session.mean_score === null ? 'This session has not been assessed yet.' : `Average monitoring score: ${session.mean_score.toFixed(1)} / 100.`}</p>
        <p className="signal-note">Model-generated support signals, not a diagnosis or a guarantee of safety. Monitoring scores and conversation-model scores use different scales.</p>
        {session.report ? <>{session.report.summary && <><h3>Session report</h3><p className="report-text">{session.report.summary}</p></>}{session.report.message && <><h3>A message for you</h3><p className="report-text">{session.report.message}</p></>}</> : <p className="muted">A written report is not available for this session yet.</p>}
        <SavedGraph session={session} />
      </div>}
    </div>
  </section>;
}
