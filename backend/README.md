# STILL-care backend

FastAPI with SQLAlchemy/SQLite, Pydantic schemas, Argon2 passwords and JWT authentication. Use the root README to install, seed and run. Interactive API docs are at `/docs` and `/redoc`.

## Configuration

Copy `.env.example` to `backend/.env` for local overrides. Never commit that file.

- `BACKEND_MODE`: mock (default) or integrated.
- `JWT_SECRET`: generate a random secret of at least 32 characters. If absent, a process-local random key is generated.
- `DATABASE_URL`: SQLite location; default is git-ignored backend/data/still.db.
- `CORS_ORIGINS`: explicit comma-separated Vite origins.
- `SIGNUP_SUPERVISOR_ID`: existing supervisor for student registration; default meera.

Run `python -m backend.db.seed` once in mock mode to create fictional users and synthetic observations. Random seed passwords are saved only to git-ignored backend/data/demo-credentials.json. Existing accounts are not overwritten.

## Endpoints

- Public: GET /api/health, POST /api/auth/login, POST /api/auth/register.
- Shared: GET /api/auth/me, GET /api/messages/{patient_id}, POST /api/messages (owner or assigned supervisor).
- Student: POST /api/checkins, POST /api/checkins/audio; GET /api/patients/{id}, /checkins, /reports, /messages, /supervisor, /trends; GET /api/checkins/{id}/report.
- Supervisor: GET /api/supervisor/patients, /patients/{id}, /patients/{id}/summaries, /patients/{id}/trends, /patients/{id}/actions, /alerts, /recommendations, /messages; POST /messages and /actions; PATCH /alerts/{id}.

## Pipeline behavior and limitations

The existing chatbot worker calls `04_chat_llm.call_ollama`; audio additionally uses existing acoustic/emotion helpers and CPU Whisper. It avoids importing the standalone Whisper script because that script runs fixed-file/CUDA work on import. The live voice loop is not invoked. Integrated dependencies are not included in the minimal backend requirements; install/configure the existing pipeline requirements and native build separately.

Written inputs use the existing text emotion model choice. Missing acoustic cues are represented as zero measurements/unknown arousal; the existing bridge maps unknown arousal to MODERATE. This is a known limitation, not a clinical interpretation.

The intelligence adapter calls the existing `ingest_from_chatbot_segments` bridge. Numeric internals never enter public schemas. Integrated alert decisions follow the existing model; external alertd delivery is disabled in favor of authenticated in-app alerts. Mock mode uses explicit `[mock:yellow]`/`[mock:red]` scenario tags, otherwise GREEN; it is deterministic workflow testing, not trained inference. Trends compare qualitative categories in mock mode and use existing model output in integrated mode.

Raw generated report prose is normalized but not exposed because it may quote private input. Supervisor summaries use controlled copy, allowlisted themes and qualitative states. The backend stores raw reflections only for owner-accessible reports. Audio upload is WAV-only, size-limited, temporary and deleted after processing. Failures return sanitized errors without prompt/transcript details.

## Tests

`python -m pytest` runs backend tests using temporary SQLite databases and generated test credentials. `python -m compileall backend` checks Python syntax. Integrated pipeline tests use adapters/stubs; passing these does not prove that heavyweight models/native dependencies are available locally.


## Conversational assistant

Student-only `GET /api/assistant/status` and `POST /api/assistant/chat` provide the assistant screen. Chat is bounded, stateless and private; completion uses the existing check-in API. In mock mode responses are scripted and labelled. In integrated mode the backend calls local Ollama at `127.0.0.1:11434/api/chat` with the configured `ASSISTANT_MODEL`. Chat messages cannot supply a system role. AI replies are user-visible text, never saved as the student's reflection or exposed as supervisor summaries.
