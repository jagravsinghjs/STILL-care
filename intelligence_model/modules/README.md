# modules/ — Still's Monitoring & Intelligence layer

Seven packages, one per Setu module (11 through 17), each independently
testable and each communicating with the others only through the shared
SQLite database — never by passing objects directly between packages.

**`module1_session_analysis/`** turns a finished session's raw `turns`
into a persisted `SessionSummary` (mean/max/min/volatility/within-session
trend, computed by scoring every turn through `still_core.TurnScorer`)
plus an optional clinician-facing PDF report. This is where the C++
numeric core first gets called from Python, and it's the only module in
this layer that touches the `turns` table directly.

**`module2_distress_monitoring/`** looks across a patient's recent
`SessionSummary` history (last 10 sessions) and fits a recency-weighted
regression to produce a `DistressTrend` — a slope, a confidence score,
and an improving/stable/worsening/insufficient_data label. Its one
non-obvious job: negating `still_core`'s raw regression slope so the
stored value follows the negative-is-worsening convention Module 13
expects downstream.

**`module3_escalation_prediction/`** is the heuristic risk-scoring
layer: `feature_extractor.py` assembles a `still_core.RiskInputs` from
the latest `DistressTrend` + triggering session's `SessionSummary` +
transcript text, `acute_keyword_detector.py` scans that transcript for
crisis language, and `heuristic_model.py` calls `still_core`'s weighted
aggregator to produce and persist an `EscalationRisk`. `trained_model.py`
and `train/` are deliberately absent — deferred until real or synthetic
training data exists.

**`module4_explainability/`** does no computation at all — it exists
purely to translate an `EscalationRisk`'s numeric `contributing_features`
into a ranked, plain-language `RiskExplanation` a supervisor can actually
read, with wording kept in `phrase_templates.py` as editable data rather
than inline logic.

**`module5_risk_classification/`** turns a continuous `EscalationRisk`
into the three-color `RiskStatus` tier (green/yellow/red) supervisors
watch, applying asymmetric hysteresis so the dashboard doesn't flicker on
one noisy session — `tier_classifier.py` does the stateless
level-to-tier mapping, `hysteresis.py` holds all the streak-counting
logic that decides whether a tier actually changes.

**`module6_alerting/`** is the only package permitted to write to the
`alerts` table. `alert_engine.py` compares a patient's `RiskStatus`
before/after Module 15's update (plus the `acute_override` flag) and
decides whether to alert; `notifier.py` best-effort pushes that alert to
`alertd` over a Unix socket, currently a guaranteed no-op since `alertd`
itself hasn't been built yet.

**`module7_intervention/`** proposes — never applies — intervention
categories. `category_rules.py` holds the rule table (currently
`COUNSELLING`, `MEDICAL`, `PROTECTION_RELOCATION` — `LEGAL_AID` and
`FINANCIAL_ASSISTANCE` are intentionally unimplemented, since nothing
upstream currently detects legal or financial distress),
`recommender.py` applies those rules and persists an
`InterventionRecommendation` with `accepted` always `None`, pending human
review.

## How this fits the larger project

These seven packages *are* Still's Monitoring & Intelligence layer —
everything between "a session just ended" and "a supervisor sees a color
and a reason why." None of them call each other's functions directly;
each reads what it needs from the database via `db/repository.py` and
writes its own output back the same way, which is what lets any module
be re-run independently against historical data without re-running the
others. `pipeline/orchestrator.py` (not yet built) is the only place
that will hard-code the 11→12→13→{14,15}→{16,17} sequence — the modules
themselves stay ignorant of what runs before or after them. Zoomed out
further: this whole folder sits downstream of Modules 6-9 (Whisper STT,
arousal detection, the emotion model, the conversational LLM — someone
else's code, reached only through `pipeline/ingest.py`) and upstream of
`api/` and the supervisor portal, which are the only things allowed to
read this layer's output from the outside.