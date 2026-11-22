# api/ — FastAPI surface for Modules 11-17

## Chatbot integration

These endpoints use the existing supervisor identity dependency:

| Method | Path | Result |
|---|---|---|
| GET | `/reports/{session_id}/combined` | Stored chatbot narrative, numerical monitoring, quality flags, and explicitly separate score scales |
| GET | `/case-groups` | Circles owned by the authenticated supervisor |
| GET | `/case-groups/alerts` | Their unacknowledged group notices; `?history=true` includes acknowledged history |
| PATCH | `/case-groups/alerts/{alert_id}/acknowledge` | Acknowledges the same delivery visible in chatbot 07's CLI |

Combined reports omit raw transcripts and the patient closing message.
Missing narrative/monitoring results are null, so a failed stage does not hide
other saved results. Current patient status/latest trend are labeled separately
from the triggering session's analysis. Group routes enforce circle ownership;
session-report routes retain the existing authentication contract and depend
on the enclosing backend for patient/caseload authorization. There is no new
identity header or login bypass. Frontend files have not been connected.

Patient status trends now retain all four values: `improving`, `stable`,
`worsening`, `insufficient_data`. Consumers must support these values.

## Route map

| Method | Path | Backs |
|---|---|---|
| GET | `/reports/{session_id}/summary` | `SessionSummary` as JSON |
| GET | `/reports/{session_id}/pdf` | Module 11's clinician PDF report |
| GET | `/dashboard/{patient_id}/status` | Current `RiskStatus` (tier) |
| GET | `/dashboard/{patient_id}/trend` | Latest `DistressTrend` |
| GET | `/dashboard/{patient_id}/history?limit=N` | Recent session score points, for charting |
| GET | `/alerts?patient_id=...` (optional) | Unacknowledged alerts |
| PATCH | `/alerts/{alert_id}/acknowledge` | Acknowledges one alert |
| GET | `/interventions/{patient_id}` | Pending `InterventionRecommendation`s |
| PATCH | `/interventions/{recommendation_id}/decision` | Records accept/dismiss |

## Auth — this layer does none

Every route depends on `get_current_supervisor` (`api/deps.py`), which
reads `request.state.supervisor_id` and raises `401` if it's missing.
**Nothing in this codebase ever sets `request.state.supervisor_id`.**
That's intentional — per architecture.md, this layer expects an
already-authenticated identity handed to it, not something it verifies
itself. (Note: "Module 3" in the architecture doc's auth note refers to
the *outer* SIH26094 project's own module numbering for
authentication/identity — a completely different numbering scheme from
this repo's Modules 11-17. Don't confuse the two.)

## Wiring this into the main Setu backend — explicit steps

This is the part that has to happen in the **main backend's codebase**,
not here. Three things:

**1. Install this package as a dependency.** From the main backend's
environment: `pip install -e /path/to/intelligence_model` (or add it as
a path dependency in whatever the main backend's `pyproject.toml` uses).
This repo's own `pyproject.toml` already exposes `api`, `modules`, `db`,
`schemas`, `pipeline` as top-level importable packages — nothing extra
needed on this side.

**2. Add middleware that sets `request.state.supervisor_id` BEFORE this
sub-app's routes run.** This has to happen in the main backend's ASGI
middleware stack, not in a per-route dependency here, because
`app.mount()` (step 3) routes requests to the sub-app *after* the main
app's middleware has already run. Example, in the main backend:

```python
# main_backend/app.py
from fastapi import FastAPI, Request

main_app = FastAPI()

@main_app.middleware("http")
async def attach_supervisor_identity(request: Request, call_next):
    # Replace this with however the main backend actually resolves identity
    # (JWT decode, session lookup, whatever Module 3 does) -- this is a stub
    # showing WHERE it needs to happen, not what auth mechanism to use.
    request.state.supervisor_id = resolve_supervisor_from_request(request)
    return await call_next(request)
```

**3. Mount `api.main.app` at whatever path prefix makes sense** (e.g.
`/still`):

```python
# main_backend/app.py, continued
from api.main import app as still_app

main_app.mount("/still", still_app)
```

After this, `GET /still/dashboard/{patient_id}/status` reaches this
codebase's dashboard router, already carrying a verified
`request.state.supervisor_id` set by the main app's own middleware.

**4. Point `STILL_DB_PATH` at the same database the pipeline writes to.**
`api/deps.py`'s `get_db()` goes through `db.connection.get_conn()`, which
reads `STILL_DB_PATH` from the environment (default `data/still.db`).
Whatever process runs the main backend needs this env var set to the
same path Modules 6-9's integration layer (or `scripts/seed_demo_data.py`
for a demo) is writing to — a mismatch here is the single most likely
"why is the dashboard showing nothing" bug during integration.

## Why `get_db()` commits automatically, unlike everywhere else in this repo

Every module and pipeline function in this codebase takes an optional
`conn=` and never calls `conn.commit()` itself — that responsibility is
always pushed to the caller. `api/deps.py`'s `get_db()` is the one place
that breaks this pattern on purpose: it's the actual top-level entry
point in production, so it's where auto-commit-on-success (via
`db.connection.get_conn()`'s context manager) finally makes sense to
apply, rather than pushing the obligation to yet another caller that
doesn't exist.
## Patient dashboard read API

`routes_patient.py` exposes `GET /patient/sessions`, `GET /patient/sessions/{session_id}`, and `GET /patient/sessions/{session_id}/graph`. Each requires the enclosing backend to attach an authenticated `request.state.patient_id`, mapped to the pipeline identity. It never accepts identity from client headers or query parameters. Every record/artifact lookup is ownership-scoped. Anonymous access is denied; private responses are not cacheable. No session creation or model generation occurs in these routes.

See [frontend/DASHBOARD.md](../../frontend/DASHBOARD.md) for the contract, artifact handling, score meanings, tests and remaining browser voice/authentication integration.
