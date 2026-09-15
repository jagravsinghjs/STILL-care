"""
modules/module2_distress_monitoring/trend_engine.py

Module 2 (Dynamic Distress Monitoring). Pulls a patient's recent
session_summary rows, feeds (session start_time, mean_score) into
still_core's recency-weighted regression, and assembles + persists a
DistressTrend.

Timestamp source: each point's x-value is the session's actual
start_time (fetched via get_session per row), NOT session_summary's
computed_at. computed_at reflects when Module 1 happened to run, which
can drift from -- or in a batch/backfill scenario, collapse onto the same
instant for -- when the sessions actually occurred. Using computed_at
flattens the trend to slope=0 in exactly that case (caught by
test_worsening_trend_negative_slope / test_improving_trend_positive_slope
during development).

Sign convention (locked-in): DistressTrend.slope is NEGATIVE when distress
is worsening, POSITIVE when improving -- this matches how
risk_aggregation.cpp's RiskInputs.trend_slope is consumed downstream
(`-inputs.trend_slope` there assumes negative-in means worsening).
still_core.TrendRegressor.fit() itself returns a raw, unflipped regression
slope of mean_score-over-time (positive raw slope = mean_score rising =
distress WORSENING) -- so this module negates it before storing.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import still_core

from db.repository import get_recent_session_summaries, get_session, insert_distress_trend
from schemas.schemas import DistressTrend, TrendLabel

WINDOW_SESSIONS = 10          # get_recent_session_summaries' own default, used explicitly here
SLOPE_STABLE_THRESHOLD = 1.5  # |stored slope| below this -> STABLE

_regressor = still_core.TrendRegressor()  # defaults: half_life=14d, growth_rate=0.5


def _label_from_slope(slope: float) -> TrendLabel:
    """slope is the already-negated, stored value (negative = worsening)."""
    if slope <= -SLOPE_STABLE_THRESHOLD:
        return TrendLabel.WORSENING
    if slope >= SLOPE_STABLE_THRESHOLD:
        return TrendLabel.IMPROVING
    return TrendLabel.STABLE


def _timestamp_days(iso_str: str) -> float:
    """
    ISO timestamp -> float days (since epoch). TrendRegressor.fit() only
    cares about relative differences between points (it computes each
    point's age relative to the most recent one internally), so the
    absolute zero-point here is arbitrary -- epoch is just a convenient,
    stable choice.
    """
    return datetime.fromisoformat(iso_str).timestamp() / 86400.0


def compute_trend(patient_id: str, conn=None) -> DistressTrend:
    """
    Computes and persists a DistressTrend for `patient_id` from their most
    recent WINDOW_SESSIONS session_summary rows.

    Fewer than 2 rows -> trend_label=INSUFFICIENT_DATA, slope=0,
    confidence=0 -- still persisted (unlike Module 11's zero-turn case):
    INSUFFICIENT_DATA is a first-class TrendLabel value precisely so this
    state is visible on the dashboard, not silently absent.
    """
    rows = get_recent_session_summaries(patient_id, limit=WINDOW_SESSIONS, conn=conn)
    window_sessions = len(rows)
    computed_at = datetime.now(timezone.utc)

    if window_sessions < 2:
        trend = DistressTrend(
            patient_id=patient_id,
            computed_at=computed_at,
            window_sessions=window_sessions,
            slope=0.0,
            trend_label=TrendLabel.INSUFFICIENT_DATA,
            confidence=0.0,
        )
    else:
        points = []
        for row in rows:
            session_row = get_session(row["session_id"], conn=conn)
            points.append(
                still_core.TrendPoint(
                    timestamp_days=_timestamp_days(session_row["start_time"]),
                    mean_score=row["mean_score"],
                )
            )
        # Explicit sort by actual session time -- session_summary rows arrive
        # ordered by computed_at, which is no longer guaranteed to match
        # start_time order (that mismatch is exactly what broke this
        # originally). TrendRegressor.fit() requires ascending timestamp_days.
        points.sort(key=lambda p: p.timestamp_days)

        result = _regressor.fit(points)
        slope = -result.slope  # see module docstring: negate to match negative-is-worsening convention

        trend = DistressTrend(
            patient_id=patient_id,
            computed_at=computed_at,
            window_sessions=window_sessions,
            slope=slope,
            trend_label=_label_from_slope(slope),
            confidence=result.confidence,
        )

    insert_distress_trend(trend, conn=conn)
    return trend