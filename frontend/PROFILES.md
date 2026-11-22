# User and consultant profiles

References inspected: root `user profile.png` and `consultant profile.png` (there is no `profile/` reference directory in this checkout). Both pages reuse `/illustrations/brand-mark.svg` unchanged.

## Frontend

- `/patient/profile`: personalization (2,000 characters), editable registered name when available, actual authenticated email, approved consultant or pending/unassigned status, avatar preview/upload and logout.
- `/supervisor/profile`: consultant identity/photo, read-only backend ID with copy buttons, editable full name and professional description (1,000 characters), real email and accepted-patient count. No Account Settings option.
- Shared implementation: `src/profiles/ProfilePage.tsx`, `service.ts`, `profiles.css`. Specific profile routes take precedence over dashboard routes and enforce the authenticated role. Failed saves preserve drafts; editing alone never persists. Photos have a separate explicit Save Photo action and Cancel.

Configure `VITE_PROFILE_API_BASE_URL=/api/intelligence/profiles` when the authenticated same-origin backend mounts the intelligence app. Existing `VITE_AUTH_API_BASE_URL` must also be connected for CSRF/session verification. Missing services produce errors, never false success or fake account details.

## Persistent API

Relative to the intelligence mount:

| Endpoint | Purpose |
|---|---|
| `GET /profiles/patient` | Name, private original narrative, real consultant association/pending status, photo availability |
| `POST /profiles/patient` | Save `{name, text}` to the authenticated patient's registry/context |
| `GET /profiles/consultant` | Existing consultant identity, saved description, actual approved count, photo availability |
| `POST /profiles/consultant` | Save `{name, text}`; ID/email/assignment changes are rejected |
| `GET /profiles/{patient-or-consultant}/photo` | Private saved PNG, no-store |
| `POST /profiles/{patient-or-consultant}/photo` | Raw JPEG/PNG/WebP body; save to authenticated role/owner only |

All identity comes from the enclosing backend's verified `request.state.patient_id` or `supervisor_id`; a consultant must also be an active registered consultant. Saves require upstream session-bound CSRF verification (`request.state.csrf_valid`). There are no client-supplied owner IDs or public photo paths. Authenticated patient login email is displayed from the existing auth response; consultant email comes from its existing backend account. The absent authentication backend still needs to supply those identities, map accounts to pipeline patient IDs, and seed registered patient names into the existing `patients` registry when available.

Schema additions use the **existing** database: the canonical `patients` table matches 06's existing registry; `patient_personalization` keeps original text separate from extracted facts; `consultant_descriptions` stores professional descriptions; `profile_photos` stores sanitized image bytes keyed by role and owner. Consultant names update `consultant_accounts`; patient names update `patients` without changing `case_facts_path`. No second account system or copies of credentials were added.

Apply the existing `init_schema()` migration mechanism before serving the API. For example, from the repository root with `STILL_DB_PATH` set to the intended absolute database path:

```bash
PYTHONPATH=intelligence_model .venv/bin/python -c 'from db.connection import init_schema; init_schema()'
```

This adds missing tables without resetting data. Development here used temporary test databases; your personal database was not migrated. Pillow is explicitly listed in Python dependencies for photo validation. Input is capped at 2 MB and 8 megapixels, static JPEG/PNG/WebP only. Images are decoded, EXIF orientation applied, resized to at most 1024×1024, stripped of metadata through re-encoding, and stored as PNG. MIME headers alone are not trusted; SVG and invalid image content are rejected.

## Chatbot personalization

`chatbot/06_case_profile/personalization.py` reads the original saved narrative for the exact pipeline patient ID. `05_voice_chat.run_conversation()` loads it at each new session, including when no structured case file has been registered. Changes are picked up on the next session; clearing and saving removes that context from future sessions.

The narrative enters the model's messages as **user-role background**, JSON encoded, with a system-level rule saying it is untrusted self-reported data and instructions inside it must not override the chatbot's role/privacy/safety rules. It is not inserted into the system prompt, treated as verified legal fact, emitted in logs, or automatically copied to the session's recorded patient turns/report. This reduces prompt-injection risk but is not a guarantee that a model will always comply.

Saving does not call an LLM or silently merge the narrative into permanent structured case facts. The existing 06 extraction/merge pipeline remains for explicit case-file updates and session conversations. This choice avoids stale facts surviving when a user edits or retracts the original narrative, while preserving the existing case-memory architecture and paths.

Both API and CLI must use the same absolute `STILL_DB_PATH`. A database without the new table yields no personalization for backward compatibility. Other database failures remain visible rather than pretending the context was loaded.

## Verification

```bash
npm run lint
npm run build
npm test
.venv/bin/python -m unittest discover -s intelligence_model/tests -p 'test_profiles.py' -v
MPLCONFIGDIR=/tmp/still-matplotlib NUMBA_CACHE_DIR=/tmp/still-numba-cache \
  .venv/bin/python -m unittest discover -s chatbot/05_voice_chat/tests -v
```

Tests cover original-text persistence, case-file-path preservation, owned/private photos, type/size validation, role/CSRF rejection, real assignment status/count, description/name updates, copy, counters, draft preservation, and responsive layouts. API-save → context-loader and a subsequent actual `run_conversation` → model-call boundary are verified, including an updated narrative on the next session. Recording and model generation are mocked for that last test: it verifies context delivery, not live model behavior or immunity to prompt injection.

Browser tests use isolated HTTP fixtures; production UI has no demonstration accounts or fabricated profile data. Full real login/re-login operation still depends on the authentication backend described in the main frontend README.
