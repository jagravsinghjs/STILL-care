# schemas/ — the single source of truth for every data shape

Two files, and everything in `modules/`, `db/`, and eventually `api/`
depends on both.

**`schemas.py`** (the project's actual immutable contract file — despite
the architecture doc's original `setu_schemas.py` naming, this repo's
locked filename is `schemas.py`) defines every Pydantic model flowing
through the system end to end: `TurnRecord`/`ArousalFeatures`/
`EmotionScores` (Modules 6-9's output, this layer's input), `TurnScore`/
`SessionSummary` (Module 11), `DistressTrend` (Module 12),
`ContributingFeature`/`EscalationRisk` (Module 13), `ExplanationFactor`/
`RiskExplanation` (Module 14), `RiskStatus` (Module 15), `Alert`
(Module 16), and `InterventionRecommendation` (Module 17) — plus every
enum (`ArousalLabel`, `TrendLabel`, `RiskLevel`, `RiskTier`,
`InterventionCategory`, `AlertStatus`) that gives those models their
fixed vocabularies. If Module 13 ever moves from heuristic to trained
model, this file's shapes are explicitly designed not to need to change —
only how they get populated.

**`serialization.py`** bridges these typed models to `schema.sql`'s six
JSON `TEXT` columns (`turns.arousal_json`/`emotion_json`,
`escalation_risk.features_json`, `risk_explanation.factors_json`,
`intervention_recommendation.categories_json`/`rationale_json`) —
`model_list_to_json()`/equivalent helpers that `repository.py` calls on
every read and write touching those columns, so no module ever
hand-rolls its own JSON encoding of a Pydantic model.

## How this fits the larger project

This folder is what makes every other README's confident cross-module
language possible — when `module2_distress_monitoring` says it produces
"a `DistressTrend`," that's not a loose description, it's a literal
Pydantic type that `db/repository.py`, `module3_escalation_prediction`,
and (eventually) `api/` all import and validate against identically.
It's also the layer with the least room for silent drift: a mismatch
between `schemas.py` and `schema.sql` (a field renamed in one but not
the other, say) wouldn't fail loudly at import time — it would fail as a
runtime `KeyError` or a silently-wrong column, potentially deep inside a
module far from where the mismatch was introduced. That's the whole
reason this file is treated as personally-maintained and
ask-before-assuming rather than something any assistant should feel free
to regenerate from the architecture doc — the architecture doc is a
starting point; `schemas.py` as it exists on disk is the actual contract.