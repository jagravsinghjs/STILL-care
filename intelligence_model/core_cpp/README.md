# core_cpp/ — the C++ numeric core

Four independent, non-polymorphic C++ classes plus their pybind11
bindings, compiled into a single Python extension module (`still_core`)
that `modules/module1_session_analysis`, `module2_distress_monitoring`,
and `module3_escalation_prediction` call into directly. Every class here
is deliberately concrete rather than an interface — each solves exactly
one problem today, runs potentially thousands of times per dashboard
render, and isn't worth a vtable indirection until (if ever) a second
implementation is actually needed.

**`turn_scoring.h`/`.cpp`** — `TurnScorer` computes a single turn's 0-100
distress score from arousal features + emotion scores using a tunable
weighted formula (`0.4×arousal + 0.2×pause + 0.4×negative-emotion-mass`,
clamped), plus a separately-surfaced `flagged_high_pause` boolean. This
is the innermost, highest-call-frequency piece of the whole system —
every single turn of every session passes through it.

**`session_stats.h`/`.cpp`** — `SessionStatsCalculator::compute()` is a
stateless static method turning a chronological list of turn scores into
mean/max/min, sample-std-dev volatility, and a first-third-vs-last-third
within-session trend slope. Returns all-zero for empty input rather than
throwing, since callers (Module 11) already guarantee a non-empty
timeline by construction.

**`trend_regression.h`/`.cpp`** — `TrendRegressor` fits a
recency-weighted (exponential decay, configurable half-life) linear
regression across a patient's session history, returning a raw slope
(unflipped — Module 12's `trend_engine.py` negates it before storing) and
a confidence score that grows with sample count but asymptotically never
reaches 1.0.

**`risk_aggregation.h`/`.cpp`** — `RiskAggregator` combines trend +
session-level signals into a single 0-100 risk score via a weighted sum,
with `acute_override` forcing `risk_score = 100.0` directly in C++ —
guaranteeing that override holds regardless of whatever thresholds
Module 13/15's Python code applies on top.

**`bindings.cpp`** is the pybind11 glue exposing all four classes (and
their input/output structs) as the `still_core` Python module, with
keyword-argument constructors matching `schemas/schemas.py`'s field
names one-to-one. `ArousalLabel` binds by enumerator name, not by
pydantic's lowercase string value — the one real gotcha this caused
(`still_core.ArousalLabel[name]` isn't valid; `getattr()` is required)
surfaced immediately in `test_module1.py`.

**`tests/`** holds four native (non-pytest) `.cpp` test files, one per
component above, using bare `assert()` and built as standalone ctest
binaries via `CMakeLists.txt` — these verify the C++ math itself in
isolation, independent of anything Python-side, and are what `pytest`'s
`test_module*.py` suite implicitly trusts rather than re-deriving.

## How this fits the larger project

This is the performance-critical floor everything else stands on. The
project's language split put numeric, high-call-frequency logic in C++
specifically so Modules 11-13 could call it thousands of times per
render without Python-level overhead, while keeping all business logic,
orchestration, and DB access in Python where it's easier to iterate on.
`still_core`'s output never reaches a database row or a supervisor's
screen directly — it always passes back through a Python module first
(`module1_session_analysis` wraps `TurnScorer`/`SessionStatsCalculator`,
`module2_distress_monitoring` wraps `TrendRegressor`,
`module3_escalation_prediction` wraps `RiskAggregator`), which is what
lets the Python side apply project-specific conventions (like Module 12's
sign-flip) on top of otherwise-generic math. If this module's formulas
ever need retuning, every weight here is already exposed as a constructor
default specifically so that's possible without touching a single call
site in `modules/`.