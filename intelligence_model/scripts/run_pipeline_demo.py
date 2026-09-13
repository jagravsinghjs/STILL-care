"""
scripts/run_pipeline_demo.py

Runs pipeline/orchestrator.run_pipeline() over every ended session
currently in data/still.db, in start_time order, and prints each
PipelineResult's fields: session summary, distress trend, escalation
risk, top explanation factor, tier transition, alert, and intervention
recommendation.

Deliberately separate from scripts/seed_demo_data.py -- see that script's
docstring for why ingest and "run the chain" are kept as two steps.
Re-running this alone (without reseeding) is safe in the sense that it
won't hit a UNIQUE-constraint error the way reseeding would, but it is
NOT a no-op: escalation_risk/risk_explanation are keyed per
(patient_id, session_id) and get overwritten in place, but risk_status's
hysteresis streak and alerts are NOT idempotent against being replayed --
running this twice over the same sessions will move the hysteresis state
machine forward again and can fire duplicate alerts. Reseed
(scripts/seed_demo_data.py against a fresh data/still.db) before re-running
this if you want a clean before/after comparison.

Processes ALL ended sessions ordered by start_time globally (not grouped
per patient) -- each patient's own trend/hysteresis state only depends on
that patient's own prior sessions, so interleaving patients here is
harmless and mirrors how sessions would actually arrive in production.
"""

from __future__ import annotations

from db.connection import get_conn
from pipeline.orchestrator import PipelineResult, run_pipeline


def _all_ended_session_ids(conn) -> list[str]:
    rows = conn.execute(
        "SELECT session_id FROM sessions WHERE end_time IS NOT NULL ORDER BY start_time ASC"
    ).fetchall()
    return [row["session_id"] for row in rows]


def _print_result(result: PipelineResult) -> None:
    print(f"\n=== session={result.session_id} patient={result.patient_id} ===")
    if result.summary is None:
        print("  zero-turn session, skipped (no summary).")
        return

    print(f"  mean_score={result.summary.mean_score:.1f} "
          f"volatility={result.summary.volatility:.1f} "
          f"within_session_trend={result.summary.within_session_trend:+.1f}")

    if result.trend is not None:
        print(f"  trend={result.trend.trend_label.value} "
              f"slope={result.trend.slope:+.2f} confidence={result.trend.confidence:.2f}")

    if result.risk is not None:
        print(f"  risk={result.risk.risk_level.value} score={result.risk.risk_score:.1f} "
              f"acute_override={result.risk.acute_override}")

    if result.explanation is not None and result.explanation.top_factors:
        print(f"  top_reason: {result.explanation.top_factors[0].description}")

    old_tier = result.old_status.tier.value if result.old_status else "none"
    new_tier = result.new_status.tier.value if result.new_status else "none"
    if old_tier != new_tier:
        print(f"  TIER CHANGE: {old_tier} -> {new_tier}")
    else:
        print(f"  tier stays: {new_tier}")

    if result.alert is not None:
        print(f"  ALERT: {result.alert.reason}")

    if result.recommendation is not None:
        print(f"  recommendation: {[c.value for c in result.recommendation.categories]}")


def main() -> None:
    with get_conn() as conn:
        session_ids = _all_ended_session_ids(conn)
        if not session_ids:
            print("No ended sessions found in data/still.db -- run scripts/seed_demo_data.py first.")
            return
        for session_id in session_ids:
            result = run_pipeline(session_id, conn=conn)
            _print_result(result)


if __name__ == "__main__":
    main()