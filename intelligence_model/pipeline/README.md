# pipeline/ — orchestration

Two entry points, two different trigger granularities, kept in separate
functions deliberately.

**`ingest.py`** has two functions, not one:

- `ingest_turn(turn, conn=None)` fires once per conversational turn.
  Modules 6-9's integration layer calls this after every turn completes.
  It only ever writes — creates the `sessions` row on first sight of a
  new `session_id` (there's no separate "start session" entry point
  anywhere in this project), then inserts the turn. Nothing downstream
  runs from this call.
- `end_session_and_run(session_id, end_time, turn_count, conn=None)`
  fires exactly once per session, called explicitly by whatever knows the
  session actually ended (a conversation UI closing, a timeout). `end_time`
  and `turn_count` aren't things this function can infer — they come from
  the caller, matching `db/repository.py`'s own `end_session()` signature.
  This is the only function in `pipeline/` that triggers the rest of the
  chain.

These are split into two functions rather than one `ingest_turn(...,
session_ended=False)` specifically so `orchestrator.run_pipeline()` can
be re-run against old, already-ingested sessions without touching
`ingest_turn` at all — re-running the downstream pipeline on historical
data (say, after retuning `still_core`'s weights, or once Module 13 gets
a trained model) never needs to fake a turn-ingestion event to do it.

**`orchestrator.py`** has one function, `run_pipeline(session_id,
conn=None)`, and it is the *only* place in this entire project that
hard-codes the Module 11→12→13→14→{15→16}→17 sequence. Every module it
calls is written to have no idea what runs before or after it — they
only know how to read what they need from the database and write their
own output back. `run_pipeline()` captures a patient's `RiskStatus`
*before* calling Module 15 specifically because Module 16 needs that
before/after pair to detect a tier transition; that's the one piece of
in-memory state this function threads through by hand rather than
re-reading from the DB.

Neither `ingest.py` nor `orchestrator.py` calls `conn.commit()` — same
convention as every module and every repository function in this
project. Whatever calls these functions in production (eventually `api/`,
or Modules 6-9's integration layer directly) is expected to commit after
a successful call.

## How this fits the larger project

This is the seam between "seven independently-testable modules" and "one
working system." Nothing in `modules/` knows this file exists — each
module can be called standalone (as every `test_module*.py` file does)
without going through `orchestrator.py` at all. That's what makes
`scripts/run_pipeline_demo.py` (not yet built) possible as a debugging
tool: it can call `run_pipeline()` directly on an old session ID and
print every intermediate artifact, without needing `api/` or a live
Modules 6-9 integration to exist. It's also why re-processing historical
data is cheap: point `run_pipeline()` at any `session_id` that already
has turns in the database, and it recomputes the full chain fresh,
regardless of whether that session was ingested five minutes ago or five
months ago.