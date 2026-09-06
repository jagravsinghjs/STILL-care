"""
modules/module1_session_analysis/aggregator.py

Module 1 (Session Analysis). Consumes a finished session's raw turns,
scores each one via still_core, persists those scores back to `turns`,
computes session-level aggregate stats via still_core, and assembles +
persists the resulting SessionSummary.

Predicts nothing -- purely descriptive. Module 2 onward handle trend/risk.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import still_core

from db.repository import (
    get_session,
    get_turns_for_session,
    get_turn_scores_for_session,
    update_turn_score,
    upsert_session_summary,
)
from schemas.schemas import ArousalFeatures, EmotionScores, SessionSummary

# Stateless/pure -- module-level instance is fine to share across calls.
_scorer = still_core.TurnScorer()


def _to_core_arousal(arousal: ArousalFeatures) -> "still_core.ArousalFeatures":
    return still_core.ArousalFeatures(
        pitch_mean=arousal.pitch_mean,
        pitch_std=arousal.pitch_std,
        energy=arousal.energy,
        zero_crossing_rate=arousal.zero_crossing_rate,
        pause_ratio=arousal.pause_ratio,
        # pybind11 enums bind by name (LOW/MODERATE/HIGH) but expose that
        # as attribute access / __members__, not subscript access like
        # Python's stdlib Enum -- getattr() bridges pydantic's lowercase
        # ArousalLabel.name ("LOW") to still_core's enum member.
        arousal_label=getattr(still_core.ArousalLabel, arousal.arousal_label.name),
    )


def _to_core_emotion(emotion: EmotionScores) -> "still_core.EmotionScores":
    return still_core.EmotionScores(
        anger=emotion.anger,
        disgust=emotion.disgust,
        fear=emotion.fear,
        joy=emotion.joy,
        neutral=emotion.neutral,
        sadness=emotion.sadness,
        surprise=emotion.surprise,
    )


def analyze_session(session_id: str, conn=None) -> Optional[SessionSummary]:
    """
    Scores every turn in `session_id`, computes session-level stats, and
    upserts the aggregate fields into `session_summary`.

    Returns the assembled SessionSummary, or None if the session has zero
    turns -- skipped silently, nothing is written to session_summary.

    Assumes the caller (pipeline/orchestrator.py) has already ended the
    session; this does not check sessions.end_time itself. If end_time is
    still NULL, SessionSummary's validation will raise -- that's treated
    as an orchestrator contract violation, not something this guards
    against.
    """
    session_row = get_session(session_id, conn=conn)
    if session_row is None:
        raise ValueError(f"analyze_session: no session found for session_id={session_id!r}")

    turns = get_turns_for_session(session_id, conn=conn)
    if not turns:
        return None  # nothing to score or summarize

    for turn in turns:
        result = _scorer.score(_to_core_arousal(turn.arousal), _to_core_emotion(turn.emotion))
        update_turn_score(turn.turn_id, result.score, result.flagged_high_pause, conn=conn)

    # Rebuild the timeline from what was just persisted (rather than from
    # the in-memory loop above) so it's sourced from the same query path
    # every other reader of session_summary.timeline will use.
    timeline = get_turn_scores_for_session(session_id, conn=conn)
    scores = [t.score for t in timeline]

    stats = still_core.SessionStatsCalculator.compute(scores)

    summary = SessionSummary(
        session_id=session_id,
        patient_id=session_row["patient_id"],
        start_time=session_row["start_time"],
        end_time=session_row["end_time"],
        turn_count=len(timeline),
        mean_score=stats.mean_score,
        max_score=stats.max_score,
        min_score=stats.min_score,
        volatility=stats.volatility,
        within_session_trend=stats.within_session_trend,
        timeline=timeline,
    )

    upsert_session_summary(summary, computed_at=datetime.now(timezone.utc), conn=conn)
    return summary