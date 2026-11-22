export interface SavedSession {
  id: string; started_at: string; ended_at: string | null; turn_count: number; mean_score: number | null;
}
export interface SavedMessage { id: string; role: 'patient' | 'assistant'; text: string; timestamp: string | null }
export interface SessionDetail extends SavedSession {
  messages: SavedMessage[]; conversation_complete: boolean; graph_available: boolean;
  report: { summary: string | null; message: string | null; timeline: { seconds: number; score: number }[] } | null;
}
export class PatientServiceError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}
const base = import.meta.env.VITE_PATIENT_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';
const invalid = () => new PatientServiceError('The saved session data could not be read. Please try again.');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== 'string') throw invalid(); return value; }
function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw invalid();
  return result;
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw invalid(); return value; }
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw invalid(); return value; }
function score(value: unknown, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}
function session(value: unknown): SavedSession {
  const data = object(value);
  if (!data.id || !Number.isInteger(data.turn_count) || Number(data.turn_count) < 0) throw invalid();
  return { id: text(data.id), started_at: date(data.started_at), ended_at: data.ended_at === null ? null : date(data.ended_at),
    turn_count: Number(data.turn_count), mean_score: score(data.mean_score, 100) };
}
function endpoint(path: string): URL {
  if (!base) throw new PatientServiceError('Your session history is not connected yet. Please try again once the service is available.');
  const url = new URL(`${base}${path}`, window.location.origin);
  if (url.origin !== window.location.origin || url.search || url.hash) throw new PatientServiceError('The session service is not configured correctly.');
  return url;
}
async function get(path: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 15000);
  try {
    const response = await fetch(endpoint(path), { credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new PatientServiceError(response.status === 401 ? 'Your session has expired. Please log in again.' :
      response.status === 404 ? 'This session is not available.' : 'We couldn’t load your saved sessions. Please try again.', response.status);
    if (!response.headers.get('content-type')?.includes('application/json')) throw invalid();
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof PatientServiceError) throw error;
    throw new PatientServiceError(controller.signal.aborted ? 'The request took too long. Please try again.' : 'We couldn’t connect to your session history. Please try again.');
  } finally { window.clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export const patientService = {
  async history(signal?: AbortSignal): Promise<SavedSession[]> {
    const data = object(await get('/sessions', signal));
    const rows = array(data.sessions).map(session);
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw invalid();
    return rows;
  },
  async detail(id: string, signal?: AbortSignal): Promise<SessionDetail> {
    const data = object(await get(`/sessions/${encodeURIComponent(id)}`, signal));
    const metadata = session(data);
    if (metadata.id !== id) throw invalid();
    const messages = array(data.messages).map((item): SavedMessage => {
      const message = object(item);
      if (message.role !== 'patient' && message.role !== 'assistant') throw invalid();
      return { id: text(message.id), role: message.role, text: text(message.text), timestamp: message.timestamp === null ? null : date(message.timestamp) };
    });
    let report: SessionDetail['report'] = null;
    if (data.report !== null) {
      const saved = object(data.report);
      report = { summary: saved.summary === null ? null : text(saved.summary), message: saved.message === null ? null : text(saved.message),
        timeline: array(saved.timeline).flatMap((item) => {
          const point = object(item); const value = score(point.score, 10);
          return value !== null && typeof point.seconds === 'number' && Number.isFinite(point.seconds) && point.seconds >= 0 ? [{ seconds: point.seconds, score: value }] : [];
        }).sort((a, b) => a.seconds - b.seconds) };
    }
    return { ...metadata, messages, report, conversation_complete: boolean(data.conversation_complete), graph_available: boolean(data.graph_available) };
  },
  graphUrl(id: string) { return endpoint(`/sessions/${encodeURIComponent(id)}/graph`).href; },
};
