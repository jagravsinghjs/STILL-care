import { useEffect, useState } from 'react';
import type { SavedSession } from '../patient/service';
export interface Patient { id: string; name: string; mean_score: number | null }
export interface Profile { consultant_id: string; display_name: string; email: string; patient_count: number }
export interface Notifications {
 unread_count: number;
 requests: { request_id: string; display_identifier: string; created_at: string; status: string }[];
 alerts: { alert_id: string; patient_id: string; reason: string; triggered_at: string; priority: string }[];
}
export interface Detail extends SavedSession { reasons?: string[]; graph_available: boolean; report: { summary: string | null; timeline: { seconds: number; score: number }[] } | null }
const base = import.meta.env.VITE_CONSULTANT_API_BASE_URL?.replace(/\/$/, '') ?? '';
export function url(path: string) {
 if (!base) throw new Error('Consultant services are not connected yet.');
 const result = new URL(base + path, location.origin);
 if (result.origin !== location.origin || result.search || result.hash) throw new Error('Consultant services are misconfigured.');
 return result.href;
}
export async function request<T>(path: string, signal?: AbortSignal, body?: object): Promise<T> {
 let token = '';
 if (body) {
  const auth = import.meta.env.VITE_AUTH_API_BASE_URL;
  if (!auth) throw new Error('Account services are not connected yet.');
  const sessionUrl = new URL(auth.replace(/\/$/, '') + '/session', location.origin);
  if (sessionUrl.origin !== location.origin) throw new Error('Account services are misconfigured.');
  const result = await fetch(sessionUrl, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!result.ok) throw new Error('Please log in again.');
  token = (await result.json()).csrfToken;
  if (typeof token !== 'string' || !token) throw new Error('Please refresh your session.');
 }
 const response = await fetch(url(path), { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), credentials: 'same-origin', cache: 'no-store', method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
 if (!response.ok) throw new Error(response.status === 409 ? 'This request has already been reviewed or the patient is already assigned. Refresh notifications.' : response.status === 401 || response.status === 403 ? 'Your account is not authorised for this request. Please log in again or contact your administrator.' : 'The requested information could not be loaded. Please try again.');
 if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The service returned an unexpected response.');
 const data = await response.json();
 if (!data || typeof data !== 'object') throw new Error('The service returned an unexpected response.');
 const list = path === '/patients' ? data.patients : path.endsWith('/sessions') ? data.sessions : null;
 if ((path === '/patients' || path.endsWith('/sessions')) && !Array.isArray(list)) throw new Error('The service returned invalid records.');
 if (path === '/notifications' && (!Array.isArray(data.requests) || !Array.isArray(data.alerts) || !Number.isInteger(data.unread_count) || data.unread_count < 0)) throw new Error('Notifications could not be read.');
 if (path === '/profile' && ['consultant_id','display_name','email'].some(key => typeof data[key] !== 'string')) throw new Error('The profile could not be read.');
 if (list && list.some((row: Record<string, unknown>) => !row || typeof row.id !== 'string' || (path === '/patients' ? typeof row.name !== 'string' : typeof row.started_at !== 'string' || !Number.isFinite(Date.parse(row.started_at as string))))) throw new Error('Saved records could not be read.');
 if (/\/sessions\/[^/]+$/.test(path) && (typeof data.id !== 'string' || !Number.isFinite(Date.parse(data.started_at)) || typeof data.graph_available !== 'boolean' || (data.report !== null && (typeof data.report !== 'object' || (data.report.summary !== null && typeof data.report.summary !== 'string'))))) throw new Error('The saved report could not be read.');
 return data as T;
}
export function useResource<T>(path: string, revision = 0) {
 const [state, set] = useState<{ path: string; data?: T; error?: string }>({ path });
 const [retry, setRetry] = useState(0);
 useEffect(() => {
  const controller = new AbortController(); set({ path });
  request<T>(path, controller.signal).then(data => { if (!controller.signal.aborted) set({ path, data }); }).catch(error => { if (!controller.signal.aborted) set({ path, error: error instanceof Error ? error.message : 'Unable to connect.' }); });
  return () => controller.abort();
 }, [path, revision, retry]);
 return { ...(state.path === path ? state : { path }), retry: () => setRetry(r => r + 1) };
}
export const part = encodeURIComponent;
