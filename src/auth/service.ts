/** Proposed cookie-based auth boundary. No mock users or local credentials. */
export type Role = 'patient' | 'supervisor';
export interface AuthUser { id: string; email: string; role: Role }
export interface LoginInput { email: string; password: string; role: Role }
export interface RegisterInput { email: string; password: string; consultantId: string }
export interface AuthService {
  configured: boolean;
  session(): Promise<AuthUser | null>;
  login(input: LoginInput): Promise<AuthUser>;
  register(input: RegisterInput): Promise<void>;
  forgotPassword(email: string, role: Role): Promise<void>;
  logout(): Promise<void>;
}

const unavailable = 'Account services are not connected yet. Please contact your consultant for help accessing STILL-care.';
const invalidResponse = 'The account service returned an unexpected response. Please try again later.';

function readUser(value: unknown): AuthUser {
  const user = value as Partial<AuthUser> | null;
  if (!user || typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' ||
      (user.role !== 'patient' && user.role !== 'supervisor')) throw new Error(invalidResponse);
  return { id: user.id, email: user.email, role: user.role };
}

export function createAuthService(baseUrl: string | undefined): AuthService {
  const base = baseUrl?.trim().replace(/\/$/, '') ?? '';
  let csrfToken: string | null = null;

  async function request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    if (!base) throw new Error(unavailable);
    // Keep account credentials on this origin. Deploy an /api/auth reverse proxy.
    const url = new URL(`${base}${path}`, window.location.origin);
    if (url.origin !== window.location.origin || url.search || url.hash) {
      throw new Error('Account services are misconfigured. Please contact your consultant.');
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ?? '' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const messages: Record<number, string> = {
          401: 'We could not sign you in. Check your email, password, and selected role.',
          403: 'This request could not be authorised. Refresh the page and try again.',
          404: unavailable,
          409: 'An account may already exist with these details. Try logging in or resetting your password.',
          422: 'Please check your details, including your Consultant ID if registering.',
          429: 'Too many attempts. Please wait a little before trying again.',
        };
        throw new Error(messages[response.status] ?? 'Account services are temporarily unavailable. Please try again later.');
      }
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(invalidResponse);
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(invalidResponse);
      return data as Record<string, unknown>;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The request took too long. Please try again.');
      if (error instanceof TypeError) throw new Error('We could not connect. Check your internet connection and try again.');
      throw error;
    } finally { window.clearTimeout(timeout); }
  }

  async function session() {
    const data = await request('/session');
    if (typeof data.csrfToken !== 'string' || !data.csrfToken) throw new Error(invalidResponse);
    csrfToken = data.csrfToken;
    return data.user === null ? null : readUser(data.user);
  }
  async function post(path: string, body: unknown) {
    if (!csrfToken) await session();
    const data = await request(path, body);
    if (typeof data.csrfToken === 'string' && data.csrfToken) csrfToken = data.csrfToken;
    return data;
  }
  return {
    configured: Boolean(base), session,
    async login(input) { return readUser((await post('/login', input)).user); },
    async register(input) {
      if ((await post('/register', input)).status !== 'created') throw new Error(invalidResponse);
    },
    async forgotPassword(email, role) {
      if ((await post('/forgot-password', { email, role })).status !== 'accepted') throw new Error(invalidResponse);
    },
    async logout() {
      if ((await post('/logout', {})).status !== 'signed_out') throw new Error(invalidResponse);
      csrfToken = null;
    },
  };
}

export const authService = createAuthService(import.meta.env.VITE_AUTH_API_BASE_URL);
export const destinationFor = (role: Role) => role === 'supervisor' ? '/supervisor' : '/patient';
