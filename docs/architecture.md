# Frontend integration

## Redesign source

The latest UI was verified in `C:/Users/varsh/Documents/Codex/2026-09-14/start-building/outputs/STILL-care`. It contains the requested final uppercase branding, signup UI, qualitative dashboard, counsellor profile, removed profile information cards and organized tests/docs.

The target repository initially contained the old UI with API-backed authentication, refresh, messaging, reports and supervisor actions. The redesign supplied layout/routes/styles; the repository supplied the real HTTP client and server-backed state. The redesign's in-memory authentication and fixed graph fixtures were deliberately not imported.

## Runtime flow

React routes -> API-backed Zustand store -> `src/api/client.ts` -> FastAPI -> SQLAlchemy -> chatbot adapter -> intelligence adapter -> reports/observations/alerts -> role-scoped API responses -> dashboard/history.

- Login accepts user ID or the stored email identifier. The selected tab must match the authenticated role.
- Signup is student-only, validates IDs/passwords, prevents duplicates, and assigns an existing configured supervisor.
- `reports` contains sanitized report fields for graphing; raw reflection text is stored separately in the owner-only history state.
- Patient endpoints fetch private history only for its owner. Supervisor state uses dedicated summary endpoints and clears private reflections.
- Old async refresh responses are discarded when the identity changes.
- Check-in creation refreshes state immediately; periodic refresh supplies cross-session message and alert changes.
- Patient graph categories use server attention states. SVG y positions are layout coordinates, not public health measurements. Mock observations are labelled.

## Organization

One root application. API tests moved to `tests/`. Historical specifications moved to `docs/archive/`; their old behavior is not the current implementation. The historical nested frontend contained only a README, now archived. Backend, chatbot and intelligence_model remain separate existing subsystems.
