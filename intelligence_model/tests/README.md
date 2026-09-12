# tests/ — the regression suite

Every file here is scoped 1:1 to what it tests, uses `pytest`'s `tmp_path`
fixture to build a fully isolated SQLite DB per test (via
`db.connection.init_schema()` + `get_raw_connection()`), and never
touches the real `data/still.db`. This layout depends on
`pyproject.toml`'s `[tool.pytest.ini_options] pythonpath = ["."]` —
without it, `from db.repository import ...` and `from modules...import
...` don't resolve when pytest runs from inside `tests/`.

**`test_db_layer.py`** predates this session's work — 14 tests, one per
table/behavior in `db/repository.py`, written during the original
database-layer build. It caught the real FK constraint on
`risk_explanation(patient_id, session_id)` referencing `escalation_risk`
early, which is exactly the constraint that later caught test-fixture
bugs in `test_module4.py` too.

**`test_module1.py`** verifies Module 11's `aggregator.py` and
`report_generator.py` against hand-solved turn-score targets (cross-checked
against `core_cpp/tests/test_session_stats.cpp`'s own reference values),
plus the zero-turn-skip and PDF-smoke-test cases.

**`test_module2.py`** verifies Module 12's `trend_engine.py`, most
importantly the sign-convention negation (raw `still_core` slope vs.
stored negative-is-worsening slope) and the switch from
`session_summary.computed_at` to actual session `start_time` as the
regression's time axis — both of which were real bugs this suite caught
before they shipped.

**`test_module3.py`** verifies Module 13's `heuristic_model.py`,
`feature_extractor.py`, and `acute_keyword_detector.py` — including an
end-to-end check that `acute_override` forces `risk_score=100` and
`risk_level=HIGH` regardless of every other signal, which is the one
guarantee this whole layer cannot afford to get wrong.

**`test_module4.py`** verifies Module 14's `explainer.py` — ranking by
`|weight|`, the acute-override phrase, graceful fallback for unknown
feature names, and persistence through the full FK chain
(`sessions` → `escalation_risk` → `risk_explanation`).

**`test_module5.py`** verifies Module 15's hysteresis logic exhaustively:
single-bad-reading non-escalation, three-consecutive-reading tier steps,
one-tier-at-a-time movement, `acute_override` bypass, streak resets on
interrupting neutral readings, and all three weighted de-escalation paths
out of RED (pure-LOW, pure-MODERATE, and mixed).

**`test_module6.py`** verifies Module 16's `alert_engine.py` — the
escalation/de-escalation/acute-override alert-firing rules and their
`[ESCALATION]`/`[ACUTE]`/`[PROGRESS]` reason-prefix convention — plus a
standalone check that `notifier.py` fails silently rather than raising
when `alertd` (which doesn't exist yet) is unreachable.

**`test_module7.py`** verifies Module 17's `recommender.py` across every
tier/acute_override combination, confirming `categories` and `rationale`
stay aligned by index and that `accepted` is always `None` on creation.

## How this fits the larger project

This suite is what turned "the code compiles" into "the code is
correct" — nearly every real bug found this session (the pybind11 enum
subscript error, the sign-convention inversion, the wrong timestamp
axis, the missing FK rows in test fixtures) was caught here, not by
inspection. It's also what makes the module-by-module build order in the
original handoff doc actually safe to follow: each module could be
declared done and moved past *because* its test file passed, not because
it looked right. Anyone extending this project inherits that same
obligation — a new module without a corresponding `test_moduleN.py` is,
by this project's own established standard, not actually finished yet.