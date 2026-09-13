# Still — Modules 11–17 (Monitoring & Intelligence layer)

This is the missing top-level README for this repo — until now the only
root doc was `INTEGRATION.md`, which is written for the two *other*
teams wiring into this one and deliberately skips the internals. This
file is the internals: what this layer actually does, how the pieces
fit together, and how to run all of it yourself, locally, end to end.

If you're integrating Modules 6-9 or the main Setu backend against this
repo, **read `INTEGRATION.md` first** — it's the contract. Come back
here when you want to understand *why* that contract looks the way it
does, or when you need to run this layer standalone (tests, a demo,
local development).

## What this is

Part of **STILL**, SIH26094 — AI-based dynamic mental health monitoring
for atrocity-act victims. This repo is specifically **Modules 11
through 17**: everything between "a check-in session just ended" and "a
supervisor sees a color, a reason, and a suggested next step." Modules
6-9 (speech-to-text, acoustic arousal, speech emotion, the conversational
LLM) are a separate team's code, reached only through `pipeline/ingest.py`.

## Data flow

```
Modules 6-9                              (someone else's code)
     |
     v
pipeline/ingest.py            ingest_turn() -- per turn, insert only
     |                        end_session_and_run() -- triggers everything below
     v
Module 11  session_analysis        raw turns -> SessionSummary (+ PDF report)
     v
Module 12  distress_monitoring     session history -> DistressTrend (slope, confidence, label)
     v
Module 13  escalation_prediction   trend + session -> EscalationRisk (score, level, acute_override)
     |
     +--> Module 14  explainability        risk -> RiskExplanation (plain-language factors)
     |
     +--> Module 15  risk_classification   risk -> RiskStatus (green/yellow/red, hysteresis)
              |
              +--> Module 16  alerting        tier change / acute -> Alert (+ push to alertd)
              |
              +--> Module 17  intervention    status -> InterventionRecommendation

api/            reads all of the above, serves it to the supervisor portal
alertd/         separate C daemon, fans out Module 16's alerts in near-real-time
```

Every arrow above is a **database write followed by a database read** —
no module calls another module's Python functions directly, and no
module holds another's output in memory. `pipeline/orchestrator.py` is
the one place that hard-codes this sequence; every module itself stays
ignorant of what runs before or after it. That's deliberate: any module
can be re-run standalone against historical data (retuned weights, a
new trained model, a bug fix) without re-running the others.

## What each module actually does

- **Module 11 (`module1_session_analysis/`)** — scores every turn in a
  finished session via `still_core.TurnScorer`, then computes
  mean/max/min/volatility/within-session-trend and persists a
  `SessionSummary`. Also generates a clinician-facing PDF on request.
  Purely descriptive — no prediction happens here.
- **Module 12 (`module2_distress_monitoring/`)** — looks across a
  patient's last 10 `SessionSummary` rows and fits a recency-weighted
  regression (`still_core.TrendRegressor`) to produce a `DistressTrend`:
  slope, confidence (grows with data, never reaches 1.0), and an
  improving/stable/worsening/insufficient_data label. Negates the raw
  regression slope so **negative = worsening** — Module 13 depends on
  that sign convention.
- **Module 13 (`module3_escalation_prediction/`)** — `feature_extractor.py`
  assembles trend + session stats + transcript into `still_core.RiskInputs`;
  `acute_keyword_detector.py` scans the transcript for crisis language
  (a starter phrase list — needs clinical review before real patients,
  see that module's own README); `heuristic_model.py` runs
  `still_core.RiskAggregator`'s weighted sum
  (`0.4·trend + 0.35·session_score + 0.25·volatility`, all 0–100) into a
  `risk_score`, then buckets it: **≤40 LOW, 41–65 MODERATE, >65 HIGH**.
  `acute_override` forces `risk_score=100` in C++ directly, unconditionally.
- **Module 14 (`module4_explainability/`)** — no computation, only
  translation: turns `EscalationRisk.contributing_features` into a
  ranked, plain-language `RiskExplanation` (wording lives in
  `phrase_templates.py` as editable data).
- **Module 15 (`module5_risk_classification/`)** — turns the continuous
  risk into the three-color `RiskTier` supervisors actually watch, with
  hysteresis so one noisy session doesn't flip the dashboard:
  escalation needs 3 consecutive worse-than-current readings, one tier
  at a time; de-escalation from YELLOW is the same flat rule; de-escalation
  from RED is weighted and needs a weighted total of 10. `acute_override`
  bypasses all of it — immediate RED, streak reset.
- **Module 16 (`module6_alerting/`)** — compares `RiskStatus` before/after
  Module 15's update and decides whether to write an `Alert`. Detect +
  notify only — never takes action itself. Urgency is encoded as a text
  prefix on `reason` (`[ESCALATION]` / `[ACUTE]` / `[PROGRESS]`), since
  `Alert`'s schema has no priority column. After writing the row,
  best-effort pushes it to **alertd** over a Unix socket so a connected
  dashboard gets it instantly instead of on its next poll.
- **Module 17 (`module7_intervention/`)** — proposes, never applies,
  intervention categories from `RiskStatus` + `acute_override`. Currently
  `COUNSELLING` (tier ≥ YELLOW), `MEDICAL` (acute), `PROTECTION_RELOCATION`
  (tier RED). `LEGAL_AID`/`FINANCIAL_ASSISTANCE` are intentionally
  unimplemented — nothing upstream currently detects legal/financial
  distress; see that module's README for what adding real support needs.

## alertd — the one non-Python piece

`alertd/` is a small multithreaded C daemon, independent of everything
above. It is **not** part of the Modules 11-17 chain and has no database
access — it's a pure relay sitting off to the side:

- `notifier.py` (Module 16) connects to its **publish** socket after every
  `Alert` insert: connect, send one JSON payload, close.
- A dashboard/frontend relay connects to its **subscribe** socket and
  stays connected; alertd only ever writes to these, newline-delimited
  so several alerts arriving close together can be split on `\n`.
- If alertd isn't running, `notifier.py`'s push silently no-ops — the
  `Alert` row itself (the actual source of truth) is already durably
  written before `notifier.py` is ever called. A missed live push just
  means the dashboard finds out on its next poll instead of instantly.

alertd is a **separate long-running process** you start and keep running
independently of the Python side — see "Running everything locally"
below, and `alertd/README.md` for the full design rationale (why two
sockets, why `sigwait()` instead of a signal handler, etc.).

## Locked design decisions — read before "fixing" anything that looks odd

These are intentional, not bugs. All of them exist because a
naming/schema choice elsewhere in the project (or the schema itself)
made the "obvious" approach impossible without a migration:

| What looks odd | Why |
|---|---|
| Module folders are `module1_session_analysis`…`module7_intervention`, not `module11`…`module17` | Deliberate deviation from architecture.md's literal numbering |
| `schemas/schemas.py`, not `setu_schemas.py`; pybind module `still_core`, not `setu_core` | Matches this project's own naming, not architecture.md's literal names |
| `DistressTrend.slope` is negative when *worsening* | Matches `risk_aggregation.cpp`'s sign expectation — flip only with the C++ side too |
| `RiskStatus.consecutive_high_assessments` is a **signed** streak counter (+escalating / −de-escalating), not a literal count of HIGH readings | Only persisted counter field the schema provides; a real migration would split this into two fields |
| `ingest_turn()` / `end_session_and_run()` are two functions, not one with a flag | So historical sessions can be re-processed independently of new ingestion |
| Every repository/module function takes `conn=` and never commits — except `api/deps.py::get_db()` | That's the one real top-level production entry point; every other "entry point" (scripts, tests) is expected to commit itself |

## Repo layout

```
core_cpp/     C++ numeric core (turn scoring, session stats, trend regression,
              risk aggregation) + pybind11 bindings -> still_core
db/           schema.sql + repository.py -- the ONLY way any module touches SQLite
schemas/      pydantic models -- the shared contract every module/API reads and writes
modules/      module1_session_analysis ... module7_intervention (Modules 11-17)
pipeline/     ingest.py (entry points) + orchestrator.py (the 11->17 sequence)
bridge/       chatbot_adapter.py -- Modules 6-9's transcript_with_emotions.json
              shape -> ingest_turn()/end_session_and_run() field mapping
api/          FastAPI sub-app (incl. routes_supervisor_view.py, the redacted
              read path), mounted by the main Setu backend
alertd/       standalone C daemon, real-time alert relay (see above)
scripts/      build_cpp.sh, seed_demo_data.py, run_pipeline_demo.py
tests/        one test_moduleN.py per module, plus integration + API tests
```

## Running everything locally

```bash
# 1. Python deps + editable install (builds still_core AND alertd via CMake)
pip install -e ".[dev]"
#    -- needs a C++ toolchain + CMake. To skip alertd's build (Threads-only,
#       no external library dependencies otherwise):
#    pip install -e ".[dev]" --config-settings=cmake.define.STILL_BUILD_ALERTD=OFF

# 2. Run the test suite (76 Python tests + 4 native C++ tests)
pytest
ctest --test-dir build

# 3. Seed a small multi-patient demo dataset, then run it through the
#    full Module 11-17 chain and print what happened at each step
python scripts/seed_demo_data.py
python scripts/run_pipeline_demo.py

# 4. Start the API (standalone, for local poking -- the main backend
#    mounts api.main.app as a sub-app in production, see INTEGRATION.md)
uvicorn api.main:app --reload

# 5. Start alertd, separately, if you want to see live alert push/relay
#    working (optional for everything above -- only matters for real-time
#    dashboard updates)
./build/alertd
```

`scripts/build_cpp.sh` wraps just step 1's CMake invocation, for
iterating on `core_cpp/`/`alertd/` without going through `pip` each time.

All of the above read/write `data/still.db` by default
(`STILL_DB_PATH` env var to change it) — delete that file to start over;
`scripts/seed_demo_data.py` is not idempotent against an existing DB
(fixed demo session IDs, see that script's own docstring).

## Known open work

Two different kinds of "not done" here — worth keeping separate, since
one kind gets closed by writing code and the other doesn't.

**Needs a decision or external sign-off, not just code:**

- `acute_keyword_detector.py`'s phrase list is a starter list, not
  clinically reviewed — see that module's README before this runs
  against real patients.
- `LEGAL_AID` / `FINANCIAL_ASSISTANCE` intervention categories
  (`modules/module7_intervention/category_rules.py`) are unimplemented.
  Not a missing-code gap — nothing upstream currently detects legal or
  financial distress, so there's no real signal to code a rule against
  yet. Needs a signal source decided first, then the same clinical
  review process as the acute phrase list above (see Module 17's README
  for exactly what adding this would require).
- `trained_model.py` / `train/` for Module 13 don't exist — the
  heuristic (`heuristic_model.py`) is the only risk model, by design,
  until real or synthetic training data exists to train against.

**Needs code, ready to be picked up any time:**

- Nothing yet decides *when* a check-in is "done" and calls
  `end_session_and_run` on the Modules 6-9 side — that trigger is still
  open glue, likely in `05_voice_chat.py` or wherever the product
  actually detects a check-in ending. See `INTEGRATION.md`.
- `api/routes_supervisor_view.py` ships with a deliberately-lying
  fallback (`PATIENT_TREND_LABEL_MAP`): the frontend's `DistressTrend`
  type only has 2 values (`improving`/`worsening`), Module 12's
  `TrendLabel` has 4, so `stable` and `insufficient_data` both currently
  get collapsed into `"worsening"` rather than shown accurately. The
  real fix is a one-line extension to `src/types/index.ts` (see that
  route file's own docstring for the exact diff) — until that lands,
  every brand-new or genuinely-stable patient shows as "worsening" on
  the frontend, which is a real false signal, not a cosmetic one.
- `modules/README.md`, `modules/module6_alerting/readme.md`, and
  `db/README.md` are stale: the first two still say alertd/orchestrator
  "hasn't been built yet" (both now exist and are tested), and
  `db/README.md` is currently a copy-paste of `modules/README.md`'s
  content under the wrong heading — it doesn't describe `db/` at all.

## Where to go from here

- **`INTEGRATION.md`** — the actual cross-team contract: what Modules
  6-9's integration layer and the main Setu backend each need to call,
  set, and mount.
- **Per-folder READMEs** (`modules/README.md`, `api/README.md`,
  `pipeline/README.md`, `db/README.md`, `schemas/README.md`,
  `alertd/README.md`, `core_cpp/README.md`) — one level deeper than
  this file, for whoever's actually working inside that folder.
- **Per-module READMEs** inside `modules/moduleN_*/` — the locked
  numeric/behavioral decisions specific to that module, in full.