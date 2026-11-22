export type ProfileRole = 'patient' | 'consultant';
export interface ProfileData {
 name: string; text: string; photo_available: boolean;
 email?: string; consultant_id?: string; patient_count?: number;
 supervisor?: { consultant_id: string; display_name: string } | null;
 assignment_status?: 'accepted' | 'pending' | 'none';
}
export function profileUrl(role: ProfileRole, suffix = '') {
 const base = import.meta.env.VITE_PROFILE_API_BASE_URL;
 if (!base) throw new Error('Profile services are not connected yet.');
 const url = new URL(`${base.replace(/\/$/, '')}/${role}${suffix}`, location.origin);
 if (url.origin !== location.origin) throw new Error('Profile service must use the same origin.');
 return url.href;
}
export async function profileRequest(role: ProfileRole, body?: { name: string; text: string } | File, signal?: AbortSignal): Promise<ProfileData | { status: string }> {
 const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
 let token = '';
 if (body) {
  const base = import.meta.env.VITE_AUTH_API_BASE_URL;
  if (!base) throw new Error('Account services are not connected yet.');
  const url = new URL(base.replace(/\/$/, '') + '/session', location.origin);
  if (url.origin !== location.origin) throw new Error('Account service must use the same origin.');
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: requestSignal });
  if (!response.ok) throw new Error('Please log in again before saving.');
  token = (await response.json()).csrfToken;
  if (typeof token !== 'string' || !token) throw new Error('Unable to verify this save request.');
 }
 const file = body instanceof File;
 const response = await fetch(profileUrl(role, file ? '/photo' : ''), { credentials: 'same-origin', cache: 'no-store', signal: requestSignal,
  method: body ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': file ? body.type : 'application/json', 'X-CSRF-Token': token } : {}) }, body: body ? file ? body : JSON.stringify(body) : undefined });
 if (!response.ok) throw new Error(response.status === 413 ? 'Please choose an image no larger than 2 MB.' : response.status === 422 || response.status === 415 ? 'Check the text limits and use a valid JPEG, PNG or WebP photo (up to 8 megapixels).' : response.status === 401 || response.status === 403 ? 'Your account could not be authorised. Please log in again.' : 'Your profile could not be loaded or saved. Please try again.');
 if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Profile service returned an unexpected response.');
 const data = await response.json();
 if (file) { if (data.status !== 'saved') throw new Error('Photo save could not be confirmed.'); }
 else if (typeof data.name !== 'string' || typeof data.text !== 'string' || typeof data.photo_available !== 'boolean' || (role === 'consultant' && (typeof data.consultant_id !== 'string' || typeof data.email !== 'string' || !Number.isInteger(data.patient_count)))) throw new Error('Profile data could not be read.');
 return data;
}
