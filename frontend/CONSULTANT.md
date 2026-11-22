# Consultant dashboard

Reference: root `consultant.png`. The authenticated supervisor destination is `/supervisor`; `/supervisor/notifications` and `/supervisor/profile` are functional subpages. Patient and authentication screens are preserved. Implementation: `src/consultant/` and `intelligence_model/api/routes_consultant.py`.

## Data and configuration

The dashboard contains no sample patients or sessions. An unavailable backend produces a retryable error; only a successful empty response shows zero patients. Set `VITE_CONSULTANT_API_BASE_URL=/api/intelligence/consultant` once the same-origin authenticated backend mounts the intelligence API. Existing auth and patient settings are unchanged.

New tables in the existing canonical SQLite schema: `consultant_accounts`, `consultant_assignment_requests`, `consultant_assignments`. Apply the existing `init_schema()` migration mechanism before enabling the router; it adds tables without resetting data. No actual user database was migrated by this change.

The main authentication backend must provision approved consultants in `consultant_accounts`; no public consultant self-registration or demo accounts are added. It must supply a verified `request.state.supervisor_id`, and must validate CSRF against the cookie session and set `request.state.csrf_valid = True` for mutations. Merely sending a header never bypasses verification.

The authentication/registration backend is still absent. When implemented, registration must validate the Consultant ID and call `create_assignment_request(conn, verified_patient_id, consultant_id, authorised_display_identifier)` in the registration transaction. This helper validates an active consultant and prevents duplicate pending requests; it does not grant access. It deliberately has no anonymous/client-identity endpoint. Existing frontend registration already sends Consultant ID. End-to-end real signup-to-notification remains dependent on wiring that backend.

## API (relative to configured base)

- `GET /profile`: registered consultant name, ID, email and assigned count.
- `GET /patients`: only explicitly accepted assignments.
- `GET /patients/{patient}/sessions`: owned saved history, newest first.
- `GET /patients/{patient}/sessions/{session}`: owned saved report, assessment reasons and graph availability. No raw conversation or patient-only closing message.
- `GET /patients/{patient}/sessions/{session}/graph`: actual generated PNG with session/patient ownership checks and no-store response.
- `GET /notifications`: persisted request history plus existing unacknowledged alerts for assigned patients. Unread means pending requests plus unacknowledged alerts; opening the page does not acknowledge them. Count is derived, never hardcoded. Refresh is manual and every 60 seconds while visible.
- `POST /requests/{id}/decision`, body `{ "accept": true/false }`: owner-only, pending-only transition. Acceptance atomically inserts a unique assignment. Rejection grants no access. Repeated decisions return 409.
- `POST /alerts/{id}/acknowledge`, body `{}`: owner-only acknowledgment of the existing monitoring alert, persisted in `alerts`.

The new routes enforce ownership themselves. Legacy intelligence routes retain their preexisting upstream caseload-auth requirements; do not expose those routes without that enforcement. The new frontend never uses those unscoped legacy report/alert routes.

## Assessments and report panel

Patient status is the latest valid saved **completed-session mean monitoring score (0–100)**, ordered by session start, not historical maximum. Session status uses its own saved mean. Shared `src/patient/distress.ts` uses the existing prototype display boundaries 40 and 65. Missing/invalid scores are Not assessed; green is Low distress, not Safe. This is not the separate acute alert priority or long-term risk tier.

The actual `mental_state.png` uses conversation-model scores on **0–10**. It is not replaced with synthetic chart data or rescored by the frontend. Graph comes first, report follows in the same scrolling panel; no tabs. Missing graph does not hide the report. Only available saved clinician summary and explanation reasons are shown; no insights or recommendations are invented. Existing alert-engine policy is unchanged, including first-session urgent review signals.

## Verification

`npm run lint`, `npm run build`, `npm test`.

`.venv/bin/python -m unittest discover -s intelligence_model/tests -p 'test_consultant_api.py' -v`

Browser fixtures are tests only; backend tests use temporary persisted SQLite records and artifacts. Tests cover empty assignments, real persisted requests, accept/reject, duplicates, scoped alerts/acknowledgment, ownership, anonymous access, CSRF gating, session selection, graph-before-report, and responsive layout. Production auth/registration wiring and account-setting editing remain unavailable; no fake successful operation is supplied for them.
