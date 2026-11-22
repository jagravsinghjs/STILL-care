# STILL-care frontend

The frontend is a React 19 + TypeScript + Vite web app. Run commands from the **repository root**, not this folder. The implementation lives in `src/`; this folder is documentation only. The supplied `login.png` and `signup.png` are the authentication references. The patient dashboard follows `user.png`; see [DASHBOARD.md](DASHBOARD.md) for its real-data API, routes, tests, and remaining voice-service integration.

## Run

Requires Node.js 22.12+ (or a compatible newer release) and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:3000. On a phone on the same network, use your computer’s LAN IP and port 3000. No Gemini key, Python process, Ollama model, or database is required to preview these authentication screens.

```bash
npm run lint       # TypeScript check; retained command name, not an ESLint ruleset
npm run typecheck  # Same strict TypeScript check
npm run build     # Type-check and production bundle in dist/
npm run preview   # Preview the production build
npm test          # Browser interaction and layout tests
```

Tests use system Chromium when `/usr/bin/chromium` exists. Otherwise run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tests start isolated Vite servers on ports 3100 and 3101. HTTP fixtures test the proposed authentication contract; they are not evidence that a real authentication backend exists.

## Source structure

```text
src/
  App.tsx                   Routes and provider
  main.tsx                  React entry point
  index.css                 Responsive screen and component styles
  styles/theme.css          Palette, typography, gradient tokens
  auth/
    service.ts              Auth interface, HTTP adapter, response validation
    AuthProvider.tsx        In-memory identity restored from server session
    validation.ts           Input validation and error focus
  components/
    AuthLayout.tsx          Shared frame, back link, landscape
    Brand.tsx               Logo, full name, tagline
    FormControls.tsx        Inputs, password toggle, buttons, feedback
    RoleSelector.tsx        Accessible User / Consultant radio group
  pages/
    LoginPage.tsx
    RegisterPage.tsx
    ForgotPasswordPage.tsx
    AccountPage.tsx         Consultant landing boundary
    patient/               Patient dashboard, profile and service availability pages
  patient/                 Patient API adapter and model display bands
  components/dashboard/    Patient shell, session history and viewer
public/illustrations/        Reusable vector logo and landscape
tests/frontend/             Browser tests (at repository root)
```

`/` opens `/login`. Registration and recovery have their own routes. User and consultant identities map to `/patient` (the dashboard) and `/supervisor` (the consultant landing boundary). A server-verified role controls navigation; changing the role selector or URL cannot create an authenticated identity. Old `/patient/login` and `/supervisor/login` links still resolve. Unknown top-level routes go to login.

## Current backend boundary

There are **no working authentication endpoints in this repository**. `backend/` contains no backend source implementation. `intelligence_model/api/` supplies monitoring, alerts, reports, and group APIs, but expects an upstream backend to authenticate callers and set `request.state.supervisor_id`. Its identity dependency is preserved. The chatbot remains usable through its existing CLI.

By default, forms validate and show “Account services are not connected yet” on submission. They do not create accounts, send recovery emails, or log anyone in. Do not use the UI as proof of a patient/consultant notification or care-workspace integration.

To connect a **future** backend implementing the contract below, put this public setting in `.env.local` and restart Vite:

```dotenv
VITE_AUTH_API_BASE_URL=/api/auth
```

Leave it unset until that service exists. The adapter requires the same origin; deploy a reverse proxy for `/api/auth`. Vite currently has no backend proxy target because no auth service exists. Do not point this setting directly at the intelligence API. `VITE_` settings are browser-visible and must never contain secrets.

### Proposed contract — not implemented server routes

All responses are JSON, including logout. User means `{ "id": "...", "email": "...", "role": "patient" | "supervisor" }`. The backend decides the role. Successful login sets a secure HttpOnly session cookie; no bearer tokens or passwords are stored in browser storage.

| Endpoint relative to configured base | Request | Successful response |
|---|---|---|
| `GET /session` | Cookie if present | `200 { "user": User-or-null, "csrfToken": "..." }`; anonymous visitors also receive a CSRF token |
| `POST /login` | `{ "email", "password", "role": "patient" or "supervisor" }` | `200 { "user": User, "csrfToken": "..." }`; server authenticates credentials and verifies role |
| `POST /register` | `{ "email", "password", "consultantId" }` | `201 { "status": "created" }`; creates a patient, then UI returns to login |
| `POST /forgot-password` | `{ "email", "role" }` | `202 { "status": "accepted" }`; same response whether account exists |
| `POST /logout` | `{}` | `200 { "status": "signed_out" }`; server invalidates the session and cookie |

Mutations include `X-CSRF-Token` obtained from `/session`. Responses may refresh it. The adapter uses same-origin credentials, no-store requests, a 12-second timeout, status-based errors, and runtime identity validation. Wrong credentials (401), forbidden/expired CSRF (403), conflict (409), invalid details/Consultant ID (422), rate limit (429), network failure, and malformed responses never become successful login.

### Backend work still required

- Credential storage and hashing, cookie session issuance/expiry/revocation, CSRF validation, origin checks, server input validation, and rate limits. Validate authorisation on every protected endpoint; frontend route guards alone are not authorisation.
- Real consultant records and approved onboarding. There is no public consultant-registration option.
- Registration must look up an active consultant and verify an invitation/approved assignment before linking a patient. A typed Consultant ID is a request, not authorisation. Reject nonexistent or unauthorised links with 422/403.
- Password-reset email delivery, single-use expiring reset tokens, and the actual reset-completion endpoint/screen. The frontend currently implements the request form only.
- Bind authenticated accounts to existing patient IDs and consultant caseloads; populate the intelligence API’s verified identity dependency. Keep report/alert access scoped to authorised patients.
- Mount the patient read API with verified patient identity as described in [DASHBOARD.md](DASHBOARD.md). Browser voice sessions, consultant communication, and the consultant workspace still require integration.

## Rebuild scope

Removed the previous mock patient/supervisor pages, demo role switcher, layouts, Zustand stores, mock APIs/types, old common components, duplicate styles, and unused raster hero images. Replaced the route tree and styling completely. Removed unused frontend dependencies and the competing Bun lockfile; npm and `package-lock.json` are now the documented dependency workflow.

Created the authentication structure above, SVG artwork, and browser tests. Retained React/Vite instead of migrating frameworks. No changes to `backend/`, `chatbot/`, `intelligence_model/`, database files, models, or existing environment configuration. Reference PNGs remain untouched. Existing generated `frontend/dist/` is not the app source; the root build writes `dist/`.

## Visual and accessibility details

Green/white palette, reference-based brain/person logo, curved corner ribbons, italic tagline, green gradient actions, rounded inputs, and a separate SVG landscape (not a screenshot background). Mobile layouts scroll naturally with short viewports; no fixed form or footer overlays the keyboard. Inputs use 16px text, appropriate autocomplete/input modes, explicit labels, error associations, keyboard focus, and 44px minimum controls. Safe-area insets and reduced-motion preference are respected. Browser viewport tests approximate keyboard-reduced height; physical Android/iOS keyboards and screen readers still need device testing.

Fonts and artwork load locally without third-party font/image requests. Desktop retains the reference’s centered composition with a larger landscape. This iteration prioritises authentication; the old mock dashboards were intentionally removed.

## Consultant dashboard

See [CONSULTANT.md](CONSULTANT.md) for the three-column consultant interface, persisted assignment requests, scoped alerts, database additions and required authentication-backend wiring.

## Profile pages

See [PROFILES.md](PROFILES.md) for the user/consultant profile pages, private photo uploads, persistence, and verified chatbot personalization integration.
