# STILL-care

> AI-based dynamic mental health monitoring for atrocity-act victims.
> SIH 2026 — Hackathon demo. All accounts and check-ins are fictional.

---

## Repository structure

```
STILL-care/
├── frontend/               React + Vite + TypeScript application
│   ├── src/
│   │   ├── api/            HTTP client, auth, continuity mapping
│   │   ├── app/            Route definitions and role guards
│   │   ├── components/     Shared controls, layout, botanical illustration
│   │   ├── features/       assistant, checkin, history, messages, progress
│   │   ├── pages/          auth (Login), patient (Dashboard, Profile), supervisor (Supervisor, Profile)
│   │   ├── store/          API-backed session state (Zustand)
│   │   ├── styles/         Global CSS / Tailwind
│   │   ├── types/          Frontend TypeScript contracts
│   │   └── utils/          Date helpers
│   ├── tests/              Vitest frontend tests
│   ├── public/             Static assets and images
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── backend/                FastAPI + SQLite application
│   ├── api/                Route handlers (auth, checkins, patients, supervisor, …)
│   ├── core/               Settings, JWT / Argon2 security
│   ├── db/                 SQLAlchemy models, migrations, seed script
│   ├── integrations/       Adapters: chatbot pipeline ↔ backend, intelligence model ↔ backend
│   ├── schemas/            Pydantic request / response models
│   ├── services/           Business logic (checkin, alert, report, continuity, …)
│   ├── tests/              Pytest backend tests
│   ├── main.py             FastAPI application factory
│   └── requirements.txt
│
├── 01_speech_to_text/      Stage 1 — Transcribe audio → timestamped transcript (faster-whisper)
│   ├── whisper.py
│   ├── input/              Place .wav files here
│   └── output/             transcript.txt / transcript.json
│
├── 02_acoustic_metrics/    Stage 2 — Extract pitch, energy, pause ratio per segment (librosa)
│   ├── acoustic_metric.py
│   ├── input/              transcript.json from Stage 1
│   └── output/             transcript_with_acoustic_metric.json
│
├── 03_adding_emotions/     Stage 3 — Speech emotion recognition per segment (wav2vec2)
│   ├── emotion.py
│   └── input/              transcript_with_acoustic_metric.json from Stage 2
│
├── 04_chat_llm/            Stage 4 — LLM analysis → distress timeline + clinician summary (Ollama)
│   ├── chat_llm.py
│   ├── input/              transcript_with_emotions.json from Stage 3
│   └── output/             report.json, mental_state.png
│
├── 05_voice_chat/          Stage 5 — Live voice conversation loop (all stages per turn, real-time)
│   ├── voice_chat.py
│   └── output/             session_<timestamp>/report.json, mental_state.png
│
├── intelligence_model/     Modules 11–17 — Monitoring and intelligence pipeline
│   ├── modules/            module1_session_analysis … module7_intervention
│   ├── pipeline/           ingest.py (entry points) + orchestrator.py (M11→M17 sequence)
│   ├── bridge/             chatbot_adapter.py — maps Stage 3/4 output → ingest_turn()
│   ├── api/                FastAPI sub-app (supervisor portal read path)
│   ├── core_cpp/           C++ numeric core (turn scoring, trend regression) + pybind11
│   ├── alertd/             Standalone C daemon for real-time alert push
│   ├── db/                 SQLite schema + repository layer
│   ├── schemas/            Pydantic contracts shared across all modules
│   ├── scripts/            build_cpp.sh, seed_demo_data.py, run_pipeline_demo.py
│   └── tests/              Per-module and integration tests
│
└── docs/
    ├── architecture.md     Integration and data-flow notes
    └── archive/            Historical frontend specifications
```

---

## Data flow

```
Student speaks / types
        │
        ▼
01_speech_to_text   (faster-whisper)  →  transcript.json
        │
        ▼
02_acoustic_metrics (librosa)          →  + pitch / energy / pause_ratio per segment
        │
        ▼
03_adding_emotions  (wav2vec2)         →  + speech_emotion_label per segment
        │
        ▼
04_chat_llm / 05_voice_chat (Ollama)  →  distress_score timeline, clinician_summary, patient_message
        │
        ▼ (via backend/integrations/)
backend FastAPI ──► SQLite (still.db)
        │
        ▼ (via intelligence_model/bridge/ + pipeline/)
intelligence_model  Modules 11–17    →  SessionSummary → DistressTrend → EscalationRisk
                                        → RiskTier (GREEN/YELLOW/RED) → Alert → Intervention
        │
        ▼
Supervisor dashboard (React frontend)
```

---

## Quick start

Python 3.11+ and Node.js 18+ are required.

### Backend

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.venv\Scripts\python.exe -m backend.db.seed
.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL (default `http://localhost:5173`).
If Vite picks a different port, add it to `CORS_ORIGINS` in `backend/.env` and restart the backend.
`VITE_API_BASE_URL` defaults to `http://127.0.0.1:8000`; copy `frontend/.env.example` to `frontend/.env` to override.

---

## Demo accounts

These are fictional hackathon accounts — not real people.

| Role | User ID | Password |
|---|---|---|
| Student | `ananya` | `StillDemo!2026` |
| Counsellor (Supervisor) | `meera` | `StillDemo!2026` |

Self-registration creates a persistent STUDENT account (Argon2-hashed password, short-lived JWT).
Supervisor self-registration is not supported.

---

## Chatbot pipeline (Stages 1–5)

Each numbered module is standalone — run it directly with Python. Stage N writes its output into its own `output/` folder, which Stage N+1 reads from `input/`. See each module's `README.md` for exact usage.

```powershell
# Install pipeline dependencies (separate from backend)
pip install faster-whisper librosa numpy requests matplotlib sounddevice soundfile transformers torch

# Stage 1 — transcribe an audio file
python 01_speech_to_text/whisper.py

# Stage 2 — extract acoustic features from the transcript
python 02_acoustic_metrics/acoustic_metric.py

# Stage 3 — add speech emotion labels
python 03_adding_emotions/emotion.py

# Stage 4 — LLM analysis (requires local Ollama + qwen2.5:7b-instruct)
python 04_chat_llm/chat_llm.py

# Stage 5 — full live voice conversation loop
python 05_voice_chat/voice_chat.py
```

---

## Intelligence model (Modules 11–17)

See [`intelligence_model/README.md`](intelligence_model/README.md) for full setup including the C++ build step.

```powershell
cd intelligence_model
pip install -e ".[dev]"   # builds still_core (C++) and alertd
pytest
python scripts/run_pipeline_demo.py
```

---

## Verification

```powershell
# Backend tests (from repo root)
.venv\Scripts\python.exe -m pytest

# Frontend (from frontend/)
cd frontend
npm run typecheck
npm test
npm run build
```

---

## Processing modes

`BACKEND_MODE=mock` (default) uses deterministic scenario tags — no external AI services needed.
`BACKEND_MODE=integrated` invokes the full pipeline and requires Ollama + the intelligence model's native dependencies. An unavailable model returns an explicit error; it never silently falls back to demo replies.

Attention states are support-workflow categories, not diagnoses or clinically validated scores.
Supervisor API endpoints return allowlisted continuity summaries — never raw student reflections.
Production deployment requires additional operational security and account-administration work beyond this local demo.
