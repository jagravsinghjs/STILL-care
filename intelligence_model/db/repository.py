"""
db/repository.py

Data-access layer for Still's Modules 11-17 layer: one typed function per
read/write operation, one table's worth of raw SQL per section below.

Per architecture.md: "so business-logic modules never write raw SQL —
keeps schema changes contained to one file." Every function here either
takes/returns a Pydantic model from schemas/setu_schemas.py, or — for the
two tables that have no dedicated external contract (`sessions` itself,
as opposed to its derived `SessionSummary`) — a plain sqlite3.Row.

Every function opens its own connection via db.connection.get_conn(). This
keeps each call transactionally self-contained, which is the right default
for a request/pipeline-driven system like this one; callers needing to
batch multiple writes in one transaction can pass an existing connection
via the optional `conn` parameter instead.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional

from connection import get_conn
from schemas.serialization import (
    enum_list_from_json,
    enum_list_to_json,
    model_from_json,
    model_list_from_json,
    model_list_to_json,
    model_to_json,
    str_list_from_json,
    str_list_to_json,
)
from schemas.schemas import (
    Alert,
    AlertStatus,
    ArousalFeatures,
    ContributingFeature,
    DistressTrend,
    EmotionScores,
    EscalationRisk,
    ExplanationFactor,
    InterventionCategory,
    InterventionRecommendation,
    RiskExplanation,
    RiskLevel,
    RiskStatus,
    RiskTier,
    SessionSummary,
    TrendLabel,
    TurnRecord,
    TurnScore,
)

ConnOrNone = Optional[sqlite3.Connection]


def _dt(iso_str: Optional[str]) -> Optional[datetime]:
    """TEXT column -> datetime, passing through None."""
    return datetime.fromisoformat(iso_str) if iso_str is not None else None


def _run(conn: ConnOrNone, fn):
    """
    Run `fn(conn)` on `conn` if one was passed in (caller manages the
    transaction), otherwise open+commit+close a fresh one via get_conn().
    """
    if conn is not None:
        return fn(conn)
    with get_conn() as new_conn:
        return fn(new_conn)


# =========================================================================
# sessions
# =========================================================================
# No dedicated Pydantic model exists for a raw session row (only its
# derived SessionSummary is part of the external contract), so these
# return sqlite3.Row directly rather than inventing a new contract type.

def create_session(session_id: str, patient_id: str, start_time: datetime, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            "INSERT INTO sessions (session_id, patient_id, start_time, turn_count) VALUES (?, ?, ?, 0)",
            (session_id, patient_id, start_time.isoformat()),
        )
    _run(conn, _do)


def end_session(session_id: str, end_time: datetime, turn_count: int, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            "UPDATE sessions SET end_time = ?, turn_count = ? WHERE session_id = ?",
            (end_time.isoformat(), turn_count, session_id),
        )
    _run(conn, _do)


def get_session(session_id: str, conn: ConnOrNone = None) -> Optional[sqlite3.Row]:
    def _do(c: sqlite3.Connection) -> Optional[sqlite3.Row]:
        cur = c.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
        return cur.fetchone()
    return _run(conn, _do)


def get_recent_sessions(patient_id: str, limit: int = 10, conn: ConnOrNone = None) -> list[sqlite3.Row]:
    def _do(c: sqlite3.Connection) -> list[sqlite3.Row]:
        cur = c.execute(
            "SELECT * FROM sessions WHERE patient_id = ? ORDER BY start_time DESC LIMIT ?",
            (patient_id, limit),
        )
        return cur.fetchall()
    return _run(conn, _do)


# =========================================================================
# turns
# =========================================================================

def insert_turn(turn: TurnRecord, conn: ConnOrNone = None) -> None:
    """
    Inserts a turn as handed off by Module 9. turn_score / flagged_high_pause
    start NULL/0 — Module 11 fills them in afterwards via update_turn_score,
    once core_cpp has scored the turn.
    """
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO turns
               (turn_id, session_id, patient_id, timestamp, transcript, arousal_json, emotion_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                turn.turn_id,
                turn.session_id,
                turn.patient_id,
                turn.timestamp.isoformat(),
                turn.transcript,
                model_to_json(turn.arousal),
                model_to_json(turn.emotion),
            ),
        )
    _run(conn, _do)


def update_turn_score(turn_id: str, score: float, flagged_high_pause: bool, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            "UPDATE turns SET turn_score = ?, flagged_high_pause = ? WHERE turn_id = ?",
            (score, int(flagged_high_pause), turn_id),
        )
    _run(conn, _do)


def _row_to_turn_record(row: sqlite3.Row) -> TurnRecord:
    return TurnRecord(
        turn_id=row["turn_id"],
        session_id=row["session_id"],
        patient_id=row["patient_id"],
        timestamp=_dt(row["timestamp"]),
        transcript=row["transcript"],
        arousal=model_from_json(row["arousal_json"], ArousalFeatures),
        emotion=model_from_json(row["emotion_json"], EmotionScores),
    )


def get_turns_for_session(session_id: str, conn: ConnOrNone = None) -> list[TurnRecord]:
    """All turns for a session, in chronological order, as TurnRecords."""
    def _do(c: sqlite3.Connection) -> list[TurnRecord]:
        cur = c.execute(
            "SELECT * FROM turns WHERE session_id = ? ORDER BY timestamp ASC", (session_id,)
        )
        return [_row_to_turn_record(row) for row in cur.fetchall()]
    return _run(conn, _do)


def get_turn_scores_for_session(session_id: str, conn: ConnOrNone = None) -> list[TurnScore]:
    """
    Turn scores + high-pause flags for a session, in chronological order —
    i.e. SessionSummary.timeline, built from the turns table rather than
    stored redundantly in session_summary. Turns not yet scored
    (turn_score IS NULL) are skipped.
    """
    def _do(c: sqlite3.Connection) -> list[TurnScore]:
        cur = c.execute(
            """SELECT turn_id, timestamp, turn_score, flagged_high_pause
               FROM turns
               WHERE session_id = ? AND turn_score IS NOT NULL
               ORDER BY timestamp ASC""",
            (session_id,),
        )
        return [
            TurnScore(
                turn_id=row["turn_id"],
                timestamp=_dt(row["timestamp"]),
                score=row["turn_score"],
                flagged_high_pause=bool(row["flagged_high_pause"]),
            )
            for row in cur.fetchall()
        ]
    return _run(conn, _do)


# =========================================================================
# session_summary
# =========================================================================
# Stores SessionSummary's aggregate fields only; `timeline` is derived from
# turns via get_turn_scores_for_session(), not persisted redundantly here.

def upsert_session_summary(summary: SessionSummary, computed_at: datetime, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO session_summary
               (session_id, patient_id, mean_score, max_score, min_score,
                volatility, within_session_trend, computed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(session_id) DO UPDATE SET
                   patient_id = excluded.patient_id,
                   mean_score = excluded.mean_score,
                   max_score = excluded.max_score,
                   min_score = excluded.min_score,
                   volatility = excluded.volatility,
                   within_session_trend = excluded.within_session_trend,
                   computed_at = excluded.computed_at""",
            (
                summary.session_id,
                summary.patient_id,
                summary.mean_score,
                summary.max_score,
                summary.min_score,
                summary.volatility,
                summary.within_session_trend,
                computed_at.isoformat(),
            ),
        )
    _run(conn, _do)


def get_session_summary_row(session_id: str, conn: ConnOrNone = None) -> Optional[sqlite3.Row]:
    """
    Raw aggregate row (no timeline — join with get_turn_scores_for_session
    if a caller needs the full SessionSummary shape).
    """
    def _do(c: sqlite3.Connection) -> Optional[sqlite3.Row]:
        cur = c.execute("SELECT * FROM session_summary WHERE session_id = ?", (session_id,))
        return cur.fetchone()
    return _run(conn, _do)


def get_recent_session_summaries(patient_id: str, limit: int = 10, conn: ConnOrNone = None) -> list[sqlite3.Row]:
    """
    Most recent session_summary rows for a patient, oldest-first — the
    (timestamp, mean_score) feed Module 12's trend_engine consumes.
    """
    def _do(c: sqlite3.Connection) -> list[sqlite3.Row]:
        cur = c.execute(
            """SELECT * FROM (
                   SELECT * FROM session_summary
                   WHERE patient_id = ?
                   ORDER BY computed_at DESC
                   LIMIT ?
               ) ORDER BY computed_at ASC""",
            (patient_id, limit),
        )
        return cur.fetchall()
    return _run(conn, _do)


# =========================================================================
# distress_trend
# =========================================================================

def insert_distress_trend(trend: DistressTrend, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO distress_trend
               (patient_id, computed_at, window_sessions, slope, trend_label, confidence)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                trend.patient_id,
                trend.computed_at.isoformat(),
                trend.window_sessions,
                trend.slope,
                trend.trend_label.value,
                trend.confidence,
            ),
        )
    _run(conn, _do)


def get_latest_distress_trend(patient_id: str, conn: ConnOrNone = None) -> Optional[DistressTrend]:
    def _do(c: sqlite3.Connection) -> Optional[DistressTrend]:
        cur = c.execute(
            """SELECT * FROM distress_trend WHERE patient_id = ?
               ORDER BY computed_at DESC LIMIT 1""",
            (patient_id,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return DistressTrend(
            patient_id=row["patient_id"],
            computed_at=_dt(row["computed_at"]),
            window_sessions=row["window_sessions"],
            slope=row["slope"],
            trend_label=TrendLabel(row["trend_label"]),
            confidence=row["confidence"],
        )
    return _run(conn, _do)


# =========================================================================
# escalation_risk
# =========================================================================

def insert_escalation_risk(risk: EscalationRisk, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO escalation_risk
               (patient_id, session_id, assessed_at, risk_score, risk_level,
                acute_override, features_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(patient_id, session_id) DO UPDATE SET
                   assessed_at = excluded.assessed_at,
                   risk_score = excluded.risk_score,
                   risk_level = excluded.risk_level,
                   acute_override = excluded.acute_override,
                   features_json = excluded.features_json""",
            (
                risk.patient_id,
                risk.session_id,
                risk.assessed_at.isoformat(),
                risk.risk_score,
                risk.risk_level.value,
                int(risk.acute_override),
                model_list_to_json(risk.contributing_features),
            ),
        )
    _run(conn, _do)


def _row_to_escalation_risk(row: sqlite3.Row) -> EscalationRisk:
    return EscalationRisk(
        patient_id=row["patient_id"],
        session_id=row["session_id"],
        assessed_at=_dt(row["assessed_at"]),
        risk_score=row["risk_score"],
        risk_level=RiskLevel(row["risk_level"]),
        acute_override=bool(row["acute_override"]),
        contributing_features=model_list_from_json(row["features_json"], ContributingFeature)
        if row["features_json"]
        else [],
    )


def get_escalation_risk(patient_id: str, session_id: str, conn: ConnOrNone = None) -> Optional[EscalationRisk]:
    def _do(c: sqlite3.Connection) -> Optional[EscalationRisk]:
        cur = c.execute(
            "SELECT * FROM escalation_risk WHERE patient_id = ? AND session_id = ?",
            (patient_id, session_id),
        )
        row = cur.fetchone()
        return _row_to_escalation_risk(row) if row else None
    return _run(conn, _do)


def get_latest_escalation_risk(patient_id: str, conn: ConnOrNone = None) -> Optional[EscalationRisk]:
    def _do(c: sqlite3.Connection) -> Optional[EscalationRisk]:
        cur = c.execute(
            """SELECT * FROM escalation_risk WHERE patient_id = ?
               ORDER BY assessed_at DESC LIMIT 1""",
            (patient_id,),
        )
        row = cur.fetchone()
        return _row_to_escalation_risk(row) if row else None
    return _run(conn, _do)


# =========================================================================
# risk_explanation
# =========================================================================

def insert_risk_explanation(explanation: RiskExplanation, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO risk_explanation
               (patient_id, session_id, generated_at, factors_json)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(patient_id, session_id) DO UPDATE SET
                   generated_at = excluded.generated_at,
                   factors_json = excluded.factors_json""",
            (
                explanation.patient_id,
                explanation.session_id,
                explanation.generated_at.isoformat(),
                model_list_to_json(explanation.top_factors),
            ),
        )
    _run(conn, _do)


def get_risk_explanation(patient_id: str, session_id: str, conn: ConnOrNone = None) -> Optional[RiskExplanation]:
    def _do(c: sqlite3.Connection) -> Optional[RiskExplanation]:
        cur = c.execute(
            "SELECT * FROM risk_explanation WHERE patient_id = ? AND session_id = ?",
            (patient_id, session_id),
        )
        row = cur.fetchone()
        if row is None:
            return None
        return RiskExplanation(
            patient_id=row["patient_id"],
            session_id=row["session_id"],
            generated_at=_dt(row["generated_at"]),
            top_factors=model_list_from_json(row["factors_json"], ExplanationFactor),
        )
    return _run(conn, _do)


# =========================================================================
# risk_status
# =========================================================================

def upsert_risk_status(status: RiskStatus, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO risk_status
               (patient_id, tier, tier_since, previous_tier, consecutive_high_assessments)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(patient_id) DO UPDATE SET
                   tier = excluded.tier,
                   tier_since = excluded.tier_since,
                   previous_tier = excluded.previous_tier,
                   consecutive_high_assessments = excluded.consecutive_high_assessments""",
            (
                status.patient_id,
                status.tier.value,
                status.tier_since.isoformat(),
                status.previous_tier.value if status.previous_tier else None,
                status.consecutive_high_assessments,
            ),
        )
    _run(conn, _do)


def get_risk_status(patient_id: str, conn: ConnOrNone = None) -> Optional[RiskStatus]:
    def _do(c: sqlite3.Connection) -> Optional[RiskStatus]:
        cur = c.execute("SELECT * FROM risk_status WHERE patient_id = ?", (patient_id,))
        row = cur.fetchone()
        if row is None:
            return None
        return RiskStatus(
            patient_id=row["patient_id"],
            tier=RiskTier(row["tier"]),
            tier_since=_dt(row["tier_since"]),
            previous_tier=RiskTier(row["previous_tier"]) if row["previous_tier"] else None,
            consecutive_high_assessments=row["consecutive_high_assessments"],
        )
    return _run(conn, _do)


# =========================================================================
# alerts
# =========================================================================
# Per architecture.md, module16_alerting/alert_engine.py is the *only*
# writer of this table — repository.py just exposes the mechanics.

def insert_alert(alert: Alert, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO alerts
               (alert_id, patient_id, triggered_at, tier, reason, status,
                acknowledged_by, acknowledged_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                alert.alert_id,
                alert.patient_id,
                alert.triggered_at.isoformat(),
                alert.tier.value,
                alert.reason,
                alert.status.value,
                alert.acknowledged_by,
                alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            ),
        )
    _run(conn, _do)


def _row_to_alert(row: sqlite3.Row) -> Alert:
    return Alert(
        alert_id=row["alert_id"],
        patient_id=row["patient_id"],
        triggered_at=_dt(row["triggered_at"]),
        tier=RiskTier(row["tier"]),
        reason=row["reason"],
        status=AlertStatus(row["status"]),
        acknowledged_by=row["acknowledged_by"],
        acknowledged_at=_dt(row["acknowledged_at"]),
    )


def get_unacknowledged_alerts(patient_id: Optional[str] = None, conn: ConnOrNone = None) -> list[Alert]:
    def _do(c: sqlite3.Connection) -> list[Alert]:
        if patient_id is not None:
            cur = c.execute(
                """SELECT * FROM alerts WHERE status = ? AND patient_id = ?
                   ORDER BY triggered_at DESC""",
                (AlertStatus.UNACKNOWLEDGED.value, patient_id),
            )
        else:
            cur = c.execute(
                "SELECT * FROM alerts WHERE status = ? ORDER BY triggered_at DESC",
                (AlertStatus.UNACKNOWLEDGED.value,),
            )
        return [_row_to_alert(row) for row in cur.fetchall()]
    return _run(conn, _do)


def acknowledge_alert(alert_id: str, acknowledged_by: str, acknowledged_at: datetime, conn: ConnOrNone = None) -> None:
    """Backs api/routes_alerts.py's PATCH /alerts/{id}/acknowledge."""
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """UPDATE alerts SET status = ?, acknowledged_by = ?, acknowledged_at = ?
               WHERE alert_id = ?""",
            (AlertStatus.ACKNOWLEDGED.value, acknowledged_by, acknowledged_at.isoformat(), alert_id),
        )
    _run(conn, _do)


def resolve_alert(alert_id: str, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute("UPDATE alerts SET status = ? WHERE alert_id = ?", (AlertStatus.RESOLVED.value, alert_id))
    _run(conn, _do)


# =========================================================================
# intervention_recommendation
# =========================================================================

def insert_intervention_recommendation(rec: InterventionRecommendation, conn: ConnOrNone = None) -> None:
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            """INSERT INTO intervention_recommendation
               (recommendation_id, patient_id, generated_at, categories_json,
                rationale_json, reviewed_by, accepted)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                rec.recommendation_id,
                rec.patient_id,
                rec.generated_at.isoformat(),
                enum_list_to_json(rec.categories),
                str_list_to_json(rec.rationale),
                rec.reviewed_by,
                None if rec.accepted is None else int(rec.accepted),
            ),
        )
    _run(conn, _do)


def _row_to_intervention_recommendation(row: sqlite3.Row) -> InterventionRecommendation:
    return InterventionRecommendation(
        recommendation_id=row["recommendation_id"],
        patient_id=row["patient_id"],
        generated_at=_dt(row["generated_at"]),
        categories=enum_list_from_json(row["categories_json"], InterventionCategory),
        rationale=str_list_from_json(row["rationale_json"]),
        reviewed_by=row["reviewed_by"],
        accepted=None if row["accepted"] is None else bool(row["accepted"]),
    )


def get_pending_interventions(patient_id: str, conn: ConnOrNone = None) -> list[InterventionRecommendation]:
    def _do(c: sqlite3.Connection) -> list[InterventionRecommendation]:
        cur = c.execute(
            """SELECT * FROM intervention_recommendation
               WHERE patient_id = ? AND accepted IS NULL
               ORDER BY generated_at DESC""",
            (patient_id,),
        )
        return [_row_to_intervention_recommendation(row) for row in cur.fetchall()]
    return _run(conn, _do)


def record_intervention_decision(
    recommendation_id: str, accepted: bool, reviewed_by: str, conn: ConnOrNone = None
) -> None:
    """Backs api/routes_interventions.py's supervisor accept/dismiss action."""
    def _do(c: sqlite3.Connection) -> None:
        c.execute(
            "UPDATE intervention_recommendation SET accepted = ?, reviewed_by = ? WHERE recommendation_id = ?",
            (int(accepted), reviewed_by, recommendation_id),
        )
    _run(conn, _do)