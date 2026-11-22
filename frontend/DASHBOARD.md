# User dashboard

Implemented from the root `user.png` reference. Authentication screens and the CLI voice pipeline are preserved.

## Run and verify

From the repository root:

```bash
npm run dev
npm run lint
npm run build
npm test
.venv/bin/python -m unittest discover -s intelligence_model/tests -p 'test_patient_api.py' -v
```

A successful patient login opens `/patient`. A verified login backend is still required; opening this route anonymously redirects to login. The application does not contain a demo login, default patient, or seeded session fallback. Browser tests supply isolated HTTP fixtures; Python tests use temporary, actually persisted SQLite records and private artifact files. They do not use or change the personal database.

Tests cover zero sessions, existing records, missing data, loading, failure/retry, report/graph rendering, model score categories, refresh without duplicates, ownership checks, profile/logout, and landscape/portrait layouts. The real browser start/complete-a-voice-session test cannot run yet: the required browser voice service does not exist. No claim is made that this missing flow works.

## Files and routes

- `src/components/dashboard/PatientLayout.tsx`: authenticated patient shell, reference-style header, navigation and SVG waves.
- `SessionHistory.tsx`: independently scrollable saved history, selection, empty/loading/error states, refresh, model status labels.
- `SessionViewer.tsx`: conversation/report switch, saved text, report, original PNG or a graph drawn from persisted report points.
- `src/pages/patient/DashboardPage.tsx`: history requests, selected-session state and refresh.
- `PatientPages.tsx`: `/patient/profile`, `/patient/consultant`, `/patient/session/new`.
- `src/patient/service.ts`: same-origin requests, cancellation/timeouts, response validation; no patient ID supplied by the browser.
- `src/patient/distress.ts`: centralized display bands and date formatting.
- `src/styles/dashboard.css`: landscape-first 40/60 layout and portrait stacking.
- `intelligence_model/api/routes_patient.py`: read-only patient API; does not create sessions or rerun models.
- `intelligence_model/api/deps.py`: upstream-verified patient identity dependency.

`/patient/dashboard` redirects to `/patient`. No session is selected automatically. No history record is created by viewing the dashboard or clicking New Session. Session numbers are display positions in the persisted history, not new database records.

## Connecting saved records

The intelligence API now includes these routes relative to its mount point:

| Route | Reads | Authorisation |
|---|---|---|
| `GET /patient/sessions` | Session ID, timestamps, turn count, saved mean score | Only sessions owned by `request.state.patient_id` |
| `GET /patient/sessions/{session_id}` | Saved conversation, report, graph availability | Ownership query before reading turns or artifacts |
| `GET /patient/sessions/{session_id}/graph` | Existing `mental_state.png` | Same ownership check, private file response |

The enclosing authentication backend must resolve its verified account to the existing pipeline patient ID and attach `request.state.patient_id`. Never derive it from a client header/query/path ID. Supervisor identity does not grant patient access. Anonymous requests get 401; unknown and other patients’ session IDs both get 404. Responses containing patient data use `Cache-Control: no-store`.

Once that backend mounts the intelligence app under `/api/intelligence`, and a same-origin reverse proxy is in place, configure:

```dotenv
VITE_AUTH_API_BASE_URL=/api/auth
VITE_PATIENT_API_BASE_URL=/api/intelligence/patient
```

Both settings are public endpoint paths, not secrets. Restart Vite after changing them. There is no automatic proxy to an unauthenticated development service. If the patient endpoint is unconfigured, fails, or returns invalid data, the UI shows a retryable error rather than claiming an empty history. A successful response with `sessions: []` is the only empty-history state.

### Data sources

- `sessions`, `session_summary`, `turns`, and `chatbot_session_reports` in the existing `STILL_DB_PATH` SQLite database provide the stored session data.
- Existing `chatbot/05_voice_chat/output/session_*/turns.json` checkpoints contain assistant replies. The API only uses a checkpoint when **both** patient ID and session ID match, then matches each reply by turn ID and patient text. Other patients’ checkpoints cannot fill a missing conversation.
- The original PNG is served only from that matching session directory. No browser-supplied path is accepted. Paths outside the trusted output directory, including symlinks escaping the session directory, are refused. The output directory must remain private, not a Vite/public or unrestricted web-server directory.
- Missing checkpoints leave the persisted patient speech visible with a partial-conversation notice. Missing reports/graphs are explicitly unavailable. Corrupt stored reports produce an error, not fabricated content.
- No SQLite schema migration, data reset, model call, chatbot modification, or static exposure of patient files was needed.

For this prototype, artifacts are found by scanning existing checkpoint metadata. At larger scale, add an owned artifact-path registry and pagination rather than scanning a long output directory or loading all history at once.

## Score semantics

History status uses the **saved Module 11 mean score, 0–100**, never a client-generated score. Display bands are centralized in `distress.ts`: 0–40 Low distress, >40–65 Moderate distress, >65–100 High distress. These reuse the numeric boundaries of the existing Module 13 risk classifier as prototype display bands; applying them to a session mean does **not** reproduce Module 13's risk calculation, acute override, supervisor-review priority, or longitudinal risk tier.

Missing, invalid, and out-of-range scores show **Not assessed**. Incomplete sessions are marked Not completed and remain Not assessed in history. Green is labelled Low distress, never Safe or Stable. The interface states that model signals are not diagnoses or guarantees of safety.

The original conversation-model report/graph uses **0–10** scores. These are displayed separately and explicitly labelled. If a PNG is unavailable but saved time/score points exist, the frontend plots those exact points; it does not infer missing scores, interpolate new data records, or substitute random values.

## Remaining integration work

1. **Authentication backend:** implement the cookie/CSRF contract in `frontend/README.md`, account-to-patient mapping, and verified consultant assignment. The dashboard does not bypass this requirement.
2. **Browser voice bridge:** the working voice-chat interface is currently a terminal process with blocking console input and a local microphone. It has no browser audio transport or authenticated start/turn/finish endpoint. New Session opens an honest unavailable page and creates nothing. Do not spawn the CLI from a GET request or treat opening a page as a saved session.
3. **Voice API contract:** a future bridge should accept start only after explicit user action, derive patient identity server-side, return an actual persisted session ID, accept validated audio for that owned session, invoke the existing pipeline, and finalize/save reports before returning completion. Suggested routes are `POST /patient/sessions`, `POST /patient/sessions/{id}/audio`, `POST /patient/sessions/{id}/finish`; these are proposals, not implemented endpoints. All require authenticated ownership and CSRF protection. After verified completion, return to `/patient` to fetch history; manual Refresh also retrieves newly persisted CLI sessions.
4. **Consultant contact/profile APIs:** the repository lacks a trusted account-to-consultant contact endpoint and messaging service. The consultant page therefore exposes no guessed identity/contact details and sends no message. Profile shows only authenticated email/role and working session logout; settings and consultant details are clearly unavailable.

The safe, working part of this change is the dashboard and authenticated read boundary. Complete browser login → voice conversation → saved report requires items 1 and 2 above; it has not been simulated as successful.
