# Integrating with Still (SIH26094 — Modules 11-17)

This document is for whoever is building Modules 6-9's integration layer,
or whoever owns the main Setu backend. It's written to be a complete,
standalone reference — you shouldn't need to read this codebase's other
`README.md` files to get a working integration, though they're linked
below for anything deeper than what's here.

## Deployment assumption — read this first

**Still currently assumes Modules 6-9, the Still pipeline, and the main
backend all run on the same machine or share a filesystem/volume.**
Storage is a single SQLite file (`STILL_DB_PATH`, default
`data/still.db`) — SQLite has no network protocol, so a process on a
different machine cannot open it.

As of this writing, this assumption holds: local demo and the initial
deployed machine are both a single `git pull` of this whole project onto
one machine. **If Modules 6-9 (or the main backend) ever move to a
separate remote service, this entire integration shape breaks** — direct
Python function calls and a shared SQLite file stop working, and
`pipeline/ingest.py` would need an HTTP or message-queue interface put in
front of it instead. That's real, un-built work, not a config change.
Nothing below assumes that future — if you're reading this because that
day has arrived, stop and design that layer first; don't try to route
around this document's instructions.

---

## Runtime checklist — what each side actually has to run

Quick reference before the detailed sections below. Everything here is
a real running thing, not a one-time setup step:

| Who | Has to run / call | Why |
|---|---|---|
| Modules 6-9's integration layer | `ingest_turn()` per turn, `end_session_and_run()` once per finished session | The only way data enters this layer at all |
| Modules 6-9's integration layer | Decide **when** a session has ended | Nothing in this repo can infer that — see the note in that section below |
| Main Setu backend | Mount `api.main.app`, with `request.state.supervisor_id` already set | Supervisor portal's only read path into this layer |
| Whoever owns process/deployment | Keep `alertd` running as its own long-lived process | Optional for correctness, required for real-time (rather than poll-only) dashboard updates — see its own section below |
| Whoever builds the dashboard's live-update client | A client that connects to alertd's **subscribe** socket and stays connected | Otherwise `alerts` are only ever seen via polling `GET /alerts` |
| Everyone above | Agree on `STILL_DB_PATH` (all three) and `STILL_ALERTD_SOCKET_PATH` / `STILL_ALERTD_SUBSCRIBE_SOCKET_PATH` (the alerting side) | See "The things everyone must agree on" at the bottom |

## For Modules 6-9's integration layer

### 1. Install this project as a dependency

```bash
pip install -e /path/to/intelligence_model
```

This requires a C++ toolchain and CMake — `core_cpp/` compiles into a
real Python extension (`still_core`) as part of this install, it's not
pure Python. `alertd` (see its own section below) builds alongside it by
default and only needs pthreads — no SQLite dependency (alertd never
touches the database). If your environment doesn't want to build it at
all, disable it explicitly:

```bash
pip install -e /path/to/intelligence_model --config-settings=cmake.define.STILL_BUILD_ALERTD=OFF
```

Python 3.11+ required (`pyproject.toml`'s `requires-python`).

### 2. Set `STILL_DB_PATH` to the SAME file the rest of Still uses

```bash
export STILL_DB_PATH=/shared/path/to/still.db
```

This must be identical to whatever the main backend's `api/` layer and
any pipeline-running process use — see the shared-database note at the
bottom of this doc.

### 3. The only two functions you need to call

No database connection setup required — both functions default to
`conn=None`, which auto-opens, auto-commits, and auto-closes a
connection internally. You do not need to import anything from `db/` at
all.

```python
from pipeline.ingest import ingest_turn, end_session_and_run
from schemas.schemas import ArousalFeatures, ArousalLabel, EmotionScores, TurnRecord
from datetime import datetime, timezone

# --- Once per conversational turn ---
turn = TurnRecord(
    turn_id="unique-turn-id",
    session_id="the-session-id",       # same session_id across every turn in one session
    patient_id="the-patient-id",
    timestamp=datetime.now(timezone.utc),
    transcript="what the patient said this turn",
    arousal=ArousalFeatures(
        pitch_mean=0.0,          # your arousal model's actual output
        pitch_std=0.0,
        energy=0.0,
        zero_crossing_rate=0.0,
        pause_ratio=0.0,         # 0.0-1.0, fraction of turn spent in silence
        arousal_label=ArousalLabel.LOW,   # LOW / MODERATE / HIGH
    ),
    emotion=EmotionScores(
        anger=0.0, disgust=0.0, fear=0.0, joy=0.0,    # each 0.0-1.0
        neutral=0.0, sadness=0.0, surprise=0.0,
    ),
)
ingest_turn(turn)

# --- Once, when you know the session has ended ---
# (conversation UI closed, timeout fired, whatever your own logic decides)
result = end_session_and_run(
    session_id="the-session-id",
    end_time=datetime.now(timezone.utc),
    turn_count=7,   # total turns in this session
)
```

That's the entire contract. `ingest_turn` only ever writes a row — it
returns nothing and has no visible side effects from your side.
`end_session_and_run` triggers the full Modules 11-17 chain and returns a
`PipelineResult` (see `pipeline/orchestrator.py`) if you want to inspect
what happened, but you're not required to do anything with the return
value.

**You do not need to create a "session" separately.** `ingest_turn`
creates the `sessions` row automatically the first time it sees a new
`session_id`.

### Field notes on `TurnRecord`

- `arousal_label` binds to a Python enum (`ArousalLabel.LOW` /
  `.MODERATE` / `.HIGH`) — pass the enum member, not a raw string.
- `EmotionScores`' seven fields are each constrained `0.0 ≤ x ≤ 1.0`
  individually (Pydantic will reject out-of-range values) but are **not**
  required to sum to 1.0 — Still's scoring math clamps defensively if
  they do exceed 1.0 in aggregate.
- `session_id`/`patient_id`/`turn_id` are all plain strings — Still has
  no opinion on their format, only that `turn_id` is unique and
  `session_id` is identical across every turn belonging to one session.

**Deeper reference if needed:** `pipeline/README.md` (the full
`ingest_turn`/`end_session_and_run` design rationale), `schemas/README.md`
and `schemas/schemas.py` (every field, every model, exact validation
rules).

---

## For the main Setu backend

### 1. Install this project as a dependency

Same as above:
```bash
pip install -e /path/to/intelligence_model
```

### 2. Set `STILL_DB_PATH` to the SAME file Modules 6-9 write to

```bash
export STILL_DB_PATH=/shared/path/to/still.db
```

### 3. Attach supervisor identity BEFORE mounting (middleware, not a dependency)

Still's `api/` layer does no authentication itself — it expects
`request.state.supervisor_id` to already be set by the time a request
reaches it. This has to be middleware in the main app, not a per-route
dependency, because `app.mount()` (next step) hands requests to the
sub-app after the main app's middleware has already run:

```python
from fastapi import FastAPI, Request

main_app = FastAPI()

@main_app.middleware("http")
async def attach_supervisor_identity(request: Request, call_next):
    # Replace with your actual identity resolution (JWT decode, session
    # lookup, whatever your auth module does)
    request.state.supervisor_id = resolve_supervisor_from_request(request)
    return await call_next(request)
```

### 4. Mount it

```python
from api.main import app as still_app

main_app.mount("/still", still_app)
```

Every route is now reachable under `/still/...` — e.g.
`GET /still/dashboard/{patient_id}/status`.

**Deeper reference if needed:** `api/README.md` (full route map, every
endpoint, why `get_db()` auto-commits when nothing else in this codebase
does).

---

## For whoever runs alertd + builds the dashboard's live-update client

This is a **third** integration point, separate from the two above, and
easy to miss because nothing about it shows up if you skip it — the
system still works correctly, just without real-time push.

`alertd` (`alertd/`) is a standalone C binary, **not** part of
`pip install -e .`'s runtime behavior in the sense of starting itself —
it's built by that install, but it has to be *run* as its own long-lived
process, separately from the Python side, same category of thing as
running a database or a message broker:

```bash
./build/alertd
# or, to override the default socket paths:
STILL_ALERTD_SOCKET_PATH=/custom/publish.sock \
STILL_ALERTD_SUBSCRIBE_SOCKET_PATH=/custom/subscribe.sock \
./build/alertd
```

**What it does:** Module 16's `notifier.py` connects to alertd's
*publish* socket after every `Alert` row is written (connect, send one
JSON payload, close). alertd fans that same payload out to every client
currently connected to its *subscribe* socket. A dashboard/frontend
relay is expected to be one of those subscribe-socket clients.

**What the dashboard's live-update client needs to do:**
1. Open a persistent connection to `STILL_ALERTD_SUBSCRIBE_SOCKET_PATH`
   (default `/tmp/still_alertd_subscribe.sock`) and keep it open.
2. Read from it continuously — alertd only ever writes to this socket,
   never reads. Each alert arrives as one JSON object followed by `\n`;
   several alerts arriving close together may show up concatenated in
   one `read()`, so split on `\n` to recover individual messages.
3. Parse each message as:
   ```json
   {"alert_id": "...", "patient_id": "...", "triggered_at": "ISO-8601",
    "tier": "green|yellow|red", "reason": "[ESCALATION] ..."}
   ```
   (exact shape is `notifier.py`'s payload — see that file if this drifts).

**What you do NOT need to do:** nothing about correctness depends on
alertd being up. If it's down, not yet started, or a subscriber isn't
connected at the moment an alert fires, that push is simply lost from
alertd's perspective — never re-delivered — and that's fine by design.
The `alerts` table (written *before* `notifier.py` is ever called) is
the durable source of truth; a missed live push just means the
dashboard finds out on its next `GET /alerts` poll instead of instantly.

**Deeper reference if needed:** `alertd/README.md` (full design —
why two sockets, why no persistence/replay, the CMake build target).

---

## The things everyone must agree on

**`STILL_DB_PATH`** — one file, one value, set identically wherever
Modules 6-9's code runs, wherever the pipeline actually executes, and
wherever the main backend's `api/` mount runs. A mismatch here is the
single most likely integration bug: everything will import cleanly,
every function call will succeed, and the dashboard will simply show
nothing, because two different SQLite files are being read from and
written to.

**`STILL_ALERTD_SOCKET_PATH`** (default `/tmp/still_alertd.sock`) and
**`STILL_ALERTD_SUBSCRIBE_SOCKET_PATH`** (default
`/tmp/still_alertd_subscribe.sock`) — must match between wherever
`alertd` itself is started, wherever Module 16's `notifier.py` runs
(i.e. wherever the pipeline executes), and wherever the dashboard's
live-update client connects. A mismatch here is silent and low-stakes
(worst case: no real-time push, same as alertd being down) rather than
a hard failure — which makes it easy to not notice for a while.