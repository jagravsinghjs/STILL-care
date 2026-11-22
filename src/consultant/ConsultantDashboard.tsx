import { useEffect, useState } from 'react';
import { Bell, UserRound, Users, ChevronRight, MessageCircle, FileText, TrendingUp, ArrowLeft } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { destinationFor } from '../auth/service';
import { DistressStatus } from '../components/dashboard/SessionHistory';
import { sessionDate } from '../patient/distress';
import type { SavedSession } from '../patient/service';
import { useResource, request, url, part, type Patient, type Notifications, type Detail } from './api';
import '../styles/dashboard.css';
import './consultant.css';

function Feedback({ error, retry }: { error?: string; retry: () => void }) {
 return <div className="consultant-feedback">{error ? <><p role="alert">{error}</p><button className="quiet-button" onClick={retry}>Try Again</button></> : <p role="status">Loading…</p>}</div>;
}
function Graph({ patient, session }: { patient: string; session: Detail }) {
 const [failed, setFailed] = useState(false);
 return session.graph_available && !failed ? <img className="consultant-graph" src={url(`/patients/${part(patient)}/sessions/${part(session.id)}/graph`)} alt="Saved mental-state graph for this session, score scale 0 to 10" onError={() => setFailed(true)} /> : <p className="muted">Mental-state graph unavailable for this session.</p>;
}
function Details({ patient, selected }: { patient: string; selected: string }) {
 const state = useResource<Detail>(`/patients/${part(patient)}/sessions/${part(selected)}`);
 if (!state.data) return <Feedback {...state} />;
 const data = state.data;
 return <><header className="consultant-detail-heading"><MessageCircle /><div><h2>Session report</h2><time>{sessionDate(data.started_at)}</time></div><DistressStatus score={data.mean_score} /></header>
 <div className="consultant-report-scroll"><section><h3><TrendingUp />Mental State Graph</h3><Graph patient={patient} session={data} /></section>
 <section><h3><FileText />Session Report</h3>{data.report?.summary ? <div className="consultant-summary"><h4>Clinician summary</h4><p>{data.report.summary}</p></div> : <p className="muted">No saved report is available for this session.</p>}
 {data.reasons && data.reasons.length > 0 && <><h4>Assessment reasons</h4><ul>{data.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></>}<p className="signal-note">Model-generated support signals, not a diagnosis or guarantee of safety. History uses the saved 0–100 monitoring score; the conversation graph uses 0–10.</p></section></div></>;
}
function Sessions({ patient, selected, choose }: { patient: Patient; selected: string | null; choose: (id: string) => void }) {
 const state = useResource<{ sessions: SavedSession[] }>(`/patients/${part(patient.id)}/sessions`);
 return <><div className="consultant-selected-patient"><UserRound /><strong>{patient.name}</strong><DistressStatus score={patient.mean_score} /></div><h2><MessageCircle />Sessions {state.data ? `(${state.data.sessions.length})` : ''}</h2>
 {!state.data ? <Feedback {...state} /> : state.data.sessions.length === 0 ? <p className="consultant-feedback">No sessions yet.</p> : <ul className="consultant-list">{state.data.sessions.map((session, index) => <li key={session.id}><button className={selected === session.id ? 'selected' : ''} aria-pressed={selected === session.id} onClick={() => choose(session.id)}><span><strong>Session {state.data!.sessions.length - index}</strong><time>{sessionDate(session.started_at)}</time><DistressStatus score={session.ended_at ? session.mean_score : null} /></span><ChevronRight /></button></li>)}</ul>}</>;
}
function NotificationPanel({ state, refresh, openPatient }: { state: ReturnType<typeof useResource<Notifications>>; refresh: () => void; openPatient: (id: string) => void }) {
 const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState('');
 async function mutate(id: string, path: string, body: object) { setBusy(id); setError(''); try { await request(path, undefined, body); refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); } finally { setBusy(null); } }
 return <section className="notification-panel"><Link className="quiet-button" to="/supervisor"><ArrowLeft />Back to patients</Link><h1>Notifications</h1><button className="quiet-button" onClick={refresh}>Refresh notifications</button>{error && <p role="alert">{error}</p>}{!state.data ? <Feedback {...state} /> : <><h2>Registration requests</h2>{state.data.requests.length === 0 && <p>No registration requests.</p>}{state.data.requests.map(r => <article key={r.request_id}><strong>{r.display_identifier}</strong><time>{sessionDate(r.created_at)}</time><span className="request-status">{r.status}</span>{r.status === 'pending' && <div className="request-actions"><button disabled={busy !== null} onClick={() => mutate(r.request_id, `/requests/${part(r.request_id)}/decision`, { accept: true })}>Accept</button><button disabled={busy !== null} onClick={() => mutate(r.request_id, `/requests/${part(r.request_id)}/decision`, { accept: false })}>Reject</button></div>}</article>)}<h2>Patient review alerts</h2>{state.data.alerts.length === 0 && <p>No unread review alerts.</p>}{state.data.alerts.map(a => <article key={a.alert_id}><strong>{a.patient_id} · {a.priority} review</strong><time>{sessionDate(a.triggered_at)}</time><p>{a.reason}</p><div className="request-actions"><Link to="/supervisor" onClick={() => openPatient(a.patient_id)}>Open patient</Link><button disabled={busy !== null} onClick={() => mutate(a.alert_id, `/alerts/${part(a.alert_id)}/acknowledge`, {})}>Mark reviewed</button></div></article>)}</>}</section>;
}
function Workspace() {
 const [revision, setRevision] = useState(0); const refresh = () => setRevision(r => r + 1);
 const patients = useResource<{ patients: Patient[] }>('/patients', revision);
 const notifications = useResource<Notifications>('/notifications', revision);
 const [patientId, setPatient] = useState<string | null>(null); const [session, setSession] = useState<string | null>(null);
 const patient = patients.data?.patients.find(p => p.id === patientId);
 const select = (id: string) => { setPatient(id); setSession(null); };
 const location = useLocation();
 useEffect(() => { document.title = 'STILL-care · Consultant dashboard'; const interval = window.setInterval(() => { if (document.visibilityState === 'visible') setRevision(r => r + 1); }, 60000); return () => clearInterval(interval); }, []);
 return <div className="patient-shell consultant-shell"><header className="patient-header"><Link to="/supervisor" className="patient-brand"><img src="/illustrations/brand-mark.svg" alt="" /><span>STILL-care</span></Link><div className="patient-mission"><p>Safety, Trust &amp; Intervention for longitudinal Life-Care</p><em>STILL here. STILL heard. STILL supported.</em></div><nav className="patient-nav"><Link to="/supervisor/notifications"><Bell /><span>Notifications</span>{notifications.data && notifications.data.unread_count > 0 && <span className="notification-count" aria-label={`${notifications.data.unread_count} unread notifications`}>{notifications.data.unread_count}</span>}</Link><Link to="/supervisor/profile"><UserRound />Profile</Link></nav><svg className="header-wave" viewBox="0 0 1600 150" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90Q170 175 380 120T800 128 1190 119 1600 94V140Q1460 185 1200 143T800 145 380 140 0 120Z" fill="#b7df9e" /></svg></header>
 <main id="main-content" className="consultant-main">{location.pathname.endsWith('/notifications') ? <NotificationPanel state={notifications} refresh={refresh} openPatient={select} /> : <div className="consultant-grid">
 <section className="consultant-column"><h1><Users />My Patients {patients.data && <small>{patients.data.patients.length} Patients</small>}</h1>{!patients.data ? <Feedback {...patients} /> : patients.data.patients.length === 0 ? <p className="consultant-feedback">No patients assigned yet.</p> : <ul className="consultant-list">{patients.data.patients.map(p => <li key={p.id}><button className={patientId === p.id ? 'selected' : ''} aria-pressed={patientId === p.id} onClick={() => select(p.id)}><UserRound /><strong>{p.name}</strong><DistressStatus score={p.mean_score} /><ChevronRight /></button></li>)}</ul>}<button className="quiet-button" onClick={refresh}>Refresh patients</button></section>
 <section className="consultant-column">{patient ? <Sessions key={patient.id} patient={patient} selected={session} choose={setSession} /> : <p className="consultant-feedback">Select a patient to view their sessions.</p>}</section>
 <section className="consultant-column consultant-details">{patient && session ? <Details key={`${patient.id}:${session}`} patient={patient.id} selected={session} /> : <p className="consultant-feedback">{patient ? 'No session selected.' : 'Select a session to view its report.'}</p>}</section>
 </div>}</main><svg className="dashboard-waves" viewBox="0 0 1600 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30Q180 0 400 60T800 75 1200 70 1600 20V100H0Z" fill="#c1e7ad" /></svg></div>;
}
export default function ConsultantDashboard() {
 const { user, restoring } = useAuth();
 if (restoring) return <p role="status">Checking session…</p>;
 if (!user) return <Navigate to="/login?role=supervisor" replace />;
 if (user.role !== 'supervisor') return <Navigate to={destinationFor(user.role)} replace />;
 return <Workspace />;
}
