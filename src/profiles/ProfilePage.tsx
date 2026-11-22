import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Camera, Check, Copy, Home, Info, LogOut, Mail, MessageCircle, Pencil, UserRound, Users, IdCard } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { authService, destinationFor } from '../auth/service';
import { profileRequest, profileUrl, type ProfileData, type ProfileRole } from './service';
import '../styles/dashboard.css';
import './profiles.css';

const message = (e: unknown) => e instanceof Error ? e.message : 'Unable to connect. Please try again.';
function Row({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
 return <div className="profile-row"><span className="profile-field-icon" aria-hidden="true">{icon}</span><span className="profile-row-label">{label}</span><div className="profile-value">{children}</div></div>;
}
function Photo({ role, exists }: { role: ProfileRole; exists: boolean }) {
 const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState(''); const [saved, setSaved] = useState(exists);
 const [revision, setRevision] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
 useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
 return <div className="profile-photo-control"><div className="profile-avatar">{preview || saved ? <img src={preview || profileUrl(role, `/photo?v=${revision}`)} alt={preview ? 'New profile photo preview' : 'Your saved profile photo'} onError={() => { setError('Photo could not be displayed. Please choose a valid image.'); setSaved(false); }} /> : <UserRound size={105} strokeWidth={1.4} aria-label="Default avatar" />}
 <label className="camera-control"><Camera aria-hidden="true" /><span className="sr-only">Change profile photo</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const next = e.target.files?.[0]; e.target.value = ''; setError(''); setSuccess(''); if (!next) return; if (!['image/jpeg','image/png','image/webp'].includes(next.type) || next.size > 2 * 1024 * 1024) { setError('Choose a JPEG, PNG or WebP photo no larger than 2 MB.'); return; } setFile(next); }} /></label></div>
 {file && <div className="photo-actions"><button disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await profileRequest(role, file); setSaved(true); setRevision(Date.now()); setFile(null); setSuccess('Photo saved.'); } catch(e) { setError(message(e)); } finally { setBusy(false); } }}>{busy ? 'Saving photo…' : 'Save Photo'}</button><button disabled={busy} onClick={() => setFile(null)}>Cancel</button></div>}
 {error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}</div>;
}
function Editor({ role }: { role: ProfileRole }) {
 const { user, setUser } = useAuth(); const consultant = role === 'consultant'; const dashboard = consultant ? '/supervisor' : '/patient';
 const [data, setData] = useState<ProfileData | null>(null); const [name, setName] = useState(''); const [text, setText] = useState('');
 const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false); const [retry, setRetry] = useState(0);
 useEffect(() => { const controller = new AbortController(); setError(''); setData(null); document.title = `STILL-care · ${consultant ? 'Consultant' : 'User'} profile`;
 profileRequest(role, undefined, controller.signal).then(value => { if (!controller.signal.aborted) { const saved = value as ProfileData; setData(saved); setName(saved.name); setText(saved.text); } }).catch(e => { if (!controller.signal.aborted) setError(message(e)); }); return () => controller.abort(); }, [role, retry, consultant]);
 const maximum = consultant ? 1000 : 2000;
 async function save() { setBusy(true); setError(''); setStatus(''); try { const saved = await profileRequest(role, { name, text }) as ProfileData; setData(saved); setName(saved.name); setText(saved.text); setStatus('Changes saved.'); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
 async function logout() { setBusy(true); setError(''); try { await authService.logout(); setUser(null); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
 async function copy() { try { await navigator.clipboard.writeText(data!.consultant_id!); setStatus('Consultant ID copied.'); } catch { setError('Copy failed. You can select and copy the Consultant ID manually.'); } }
 const copyButton = <button type="button" className="icon-button" aria-label="Copy Consultant ID" onClick={copy}><Copy size={20} /></button>;
 const description = <div className="profile-text-editor"><label htmlFor="profile-text" className={consultant ? 'profile-section-heading' : 'sr-only'}>{consultant ? <><Info />About You (for Patient Matching)</> : 'Personalization text'}</label><div className="profile-textarea-wrap"><textarea id="profile-text" value={text} maxLength={maximum} disabled={busy} placeholder={consultant ? "Add a short professional description, your areas of expertise, or any information you'd like patients to know..." : 'Write about your past experiences, case details, concerns, or any context you want the chatbot to remember...'} onChange={e => { setText(e.target.value); setStatus(''); }} /><span className="character-counter" aria-live="polite">{text.length} / {maximum}</span></div></div>;
 const nameField = <Row label={consultant ? 'Full Name' : 'Name'} icon={<UserRound />}><input aria-label={consultant ? 'Full Name' : 'Name'} value={name} maxLength={120} disabled={busy} placeholder="Name not provided" onChange={e => { setName(e.target.value); setStatus(''); }} /><Pencil size={18} aria-hidden="true" /></Row>;
 const saveButton = <button type="button" className="button button--primary profile-save" disabled={busy || text.length > maximum} onClick={save}><Check />{busy ? 'Saving…' : 'Save Changes'}</button>;
 return <div className="patient-shell profile-shell"><header className="patient-header"><Link to={dashboard} className="patient-brand"><img src="/illustrations/brand-mark.svg" alt="" /><span>STILL-care</span></Link><div className="patient-mission"><p>Safety, Trust &amp; Intervention for longitudinal Life-Care</p><em>STILL here. STILL heard. STILL supported.</em></div><nav className="patient-nav"><Link to={dashboard}><Home />Back to Dashboard</Link></nav><svg className="profile-top-wave" viewBox="0 0 1600 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 15C240 100 350-35 570 15S870 60 1080 20 1400 85 1600 0V30C1400 110 1240 0 1080 40S800 70 570 35 240 120 0 35Z" fill="#c4e9b2" /></svg></header>
 <main id="main-content" className="profile-main">
 {!data ? <div className="profile-feedback">{error ? <><p role="alert">{error}</p><button className="quiet-button" onClick={() => setRetry(retry + 1)}>Try Again</button></> : <p role="status">Loading your profile…</p>}<button className="quiet-button" onClick={logout} disabled={busy}>Sign Out</button></div> : <>
 <div className={`profile-columns ${consultant ? 'profile-columns--consultant' : ''}`}>
 {consultant ? <aside className="profile-identity"><Photo role={role} exists={data.photo_available} /><h1>{data.name}</h1><p>Consultant</p><div className="consultant-id-pill">Consultant ID: {data.consultant_id}{copyButton}</div><a className="profile-navigation selected" href="#profile-details"><UserRound />Profile Details</a><button className="profile-navigation" disabled={busy} onClick={logout}><LogOut />Logout</button></aside> : <section className="personalization-panel"><h1><MessageCircle />Personalize Your Chatbot</h1><p>Help STILL-care support you better by sharing, in your own words, your past experiences, case context, or anything you'd like the chatbot to understand about you.</p>{description}{saveButton}</section>}
 <section className="profile-information" id="profile-details">
 {consultant ? <><h1><UserRound />Profile Details</h1><p className="profile-subtitle">Your consultant information and account details.</p>{nameField}<Row label="Email (Login)" icon={<Mail />}><span>{data.email}</span></Row><Row label="Consultant ID" icon={<IdCard />}><span>{data.consultant_id}</span>{copyButton}</Row><Row label="Assigned Patients" icon={<Users />}><span>{data.patient_count} Patients</span></Row><div className="profile-about">{description}{saveButton}</div></> : <><Photo role={role} exists={data.photo_available} />{nameField}<Row label="Supervisor" icon={<Users />}><span>{data.supervisor ? `${data.supervisor.display_name} (${data.supervisor.consultant_id})` : data.assignment_status === 'pending' ? 'Awaiting consultant approval.' : 'No consultant assigned.'}</span></Row><Row label="Gmail (Login)" icon={<Mail />}><span>{user?.email}</span></Row><button className="quiet-button profile-logout" disabled={busy} onClick={logout}><LogOut size={18} />Sign Out</button></>}
 </section></div>{error && <p className="profile-feedback" role="alert">{error}</p>}{status && <p className="profile-feedback" role="status">{status}</p>}</>}</main><svg className="dashboard-waves" viewBox="0 0 1600 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 50C240-35 290 90 520 55S850 100 1060 55 1300 0 1600 35V100H0Z" fill="#ddf2cd"/><path d="M0 85C330 25 400 130 730 80S1100 140 1330 60 1470 30 1600 45V100H0Z" fill="#83c765"/></svg></div>;
}
export default function ProfilePage({ role }: { role: ProfileRole }) {
 const { user, restoring } = useAuth(); const authRole = role === 'consultant' ? 'supervisor' : 'patient';
 if (restoring) return <p role="status">Checking session…</p>;
 if (!user) return <Navigate to={`/login?role=${authRole}`} replace />;
 if (user.role !== authRole) return <Navigate to={destinationFor(user.role)} replace />;
 return <Editor role={role} />;
}
