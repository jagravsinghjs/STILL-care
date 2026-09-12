"""
modules/module5_risk_classification/hysteresis.py

Module 15 -- the "don't flip on one bad reading" logic, applied to every
tier transition (not just escalation to RED). See this module's README
for the full rules; summarized here in the constants below.

STATE REPURPOSING: RiskStatus.consecutive_high_assessments is the only
persisted counter available (per schema.sql), so it's repurposed as a
SIGNED streak counter:
    > 0  -> building toward escalation (candidate worse than current tier)
    < 0  -> building toward de-escalation (candidate better than current tier)
    == 0 -> no streak in progress (last reading matched current tier, or a
            streak just resolved and reset)
This means the field no longer literally means "count of HIGH
assessments" -- it means "current streak, signed by direction." Flagging
this explicitly since it's a deliberate deviation from the field's literal
name, made to avoid a schema change.
"""

from __future__ import annotations

from datetime import datetime

from schemas.schemas import RiskStatus, RiskTier
from .tier_classifier import TIER_ORDER

ESCALATE_STREAK_N = 3          # GREEN->YELLOW, YELLOW->RED, and YELLOW->GREEN de-escalation
RED_DEESCALATE_LOW_WEIGHT = 2       # candidate GREEN (risk_level LOW) while at RED
RED_DEESCALATE_MODERATE_WEIGHT = 1  # candidate YELLOW (risk_level MODERATE) while at RED
RED_DEESCALATE_THRESHOLD = 10       # weighted total needed to step RED -> YELLOW

_NEXT_TIER_UP = {RiskTier.GREEN: RiskTier.YELLOW, RiskTier.YELLOW: RiskTier.RED}
_NEXT_TIER_DOWN = {RiskTier.YELLOW: RiskTier.GREEN, RiskTier.RED: RiskTier.YELLOW}


def _default_status(patient_id: str, now: datetime) -> RiskStatus:
    """A patient with no prior risk_status row starts at GREEN, no streak."""
    return RiskStatus(
        patient_id=patient_id,
        tier=RiskTier.GREEN,
        tier_since=now,
        previous_tier=None,
        consecutive_high_assessments=0,
    )


def apply_hysteresis(
    patient_id: str,
    candidate: RiskTier,
    acute_override: bool,
    current: RiskStatus | None,
    now: datetime,
) -> RiskStatus:
    """
    Pure function: given the candidate tier this reading suggests, the
    acute_override flag, the patient's current RiskStatus (or None if
    they have none yet), and the current time, returns the NEW RiskStatus
    to persist. Does not touch the DB itself -- tier_classifier's caller
    (__init__.classify_status) handles reading/writing.
    """
    state = current if current is not None else _default_status(patient_id, now)

    # acute_override bypasses everything: immediate RED, streak reset.
    if acute_override:
        return _transition(state, RiskTier.RED, new_streak=0, now=now)

    current_rank = TIER_ORDER[state.tier]
    candidate_rank = TIER_ORDER[candidate]

    # Neutral: candidate matches current tier exactly -- no streak building.
    if candidate_rank == current_rank:
        return _transition(state, state.tier, new_streak=0, now=now)

    # Escalation direction (candidate worse than current tier) -- flat N=3,
    # one tier at a time, regardless of how much worse candidate is.
    if candidate_rank > current_rank:
        streak = state.consecutive_high_assessments + 1 if state.consecutive_high_assessments > 0 else 1
        if streak >= ESCALATE_STREAK_N:
            return _transition(state, _NEXT_TIER_UP[state.tier], new_streak=0, now=now)
        return _transition(state, state.tier, new_streak=streak, now=now)

    # De-escalation direction (candidate better than current tier).
    if state.tier == RiskTier.YELLOW:
        # YELLOW -> GREEN: same flat N=3 as escalation.
        streak = state.consecutive_high_assessments - 1 if state.consecutive_high_assessments < 0 else -1
        if abs(streak) >= ESCALATE_STREAK_N:
            return _transition(state, _NEXT_TIER_DOWN[state.tier], new_streak=0, now=now)
        return _transition(state, state.tier, new_streak=streak, now=now)

    if state.tier == RiskTier.RED:
        # RED -> YELLOW: weighted. candidate GREEN (risk_level LOW) counts
        # more than candidate YELLOW (risk_level MODERATE).
        weight = RED_DEESCALATE_LOW_WEIGHT if candidate == RiskTier.GREEN else RED_DEESCALATE_MODERATE_WEIGHT
        streak = state.consecutive_high_assessments - weight if state.consecutive_high_assessments < 0 else -weight
        if abs(streak) >= RED_DEESCALATE_THRESHOLD:
            return _transition(state, _NEXT_TIER_DOWN[state.tier], new_streak=0, now=now)
        return _transition(state, state.tier, new_streak=streak, now=now)

    # state.tier == GREEN with a de-escalation-direction reading is
    # unreachable (nothing is less severe than GREEN), but handled for
    # completeness rather than silently falling through.
    return _transition(state, state.tier, new_streak=0, now=now)


def _transition(state: RiskStatus, new_tier: RiskTier, new_streak: int, now: datetime) -> RiskStatus:
    if new_tier != state.tier:
        return RiskStatus(
            patient_id=state.patient_id,
            tier=new_tier,
            tier_since=now,
            previous_tier=state.tier,
            consecutive_high_assessments=new_streak,
        )
    return RiskStatus(
        patient_id=state.patient_id,
        tier=state.tier,
        tier_since=state.tier_since,
        previous_tier=state.previous_tier,
        consecutive_high_assessments=new_streak,
    )