"""
modules/module5_risk_classification/tier_classifier.py

Module 15 -- pure mapping from EscalationRisk.risk_level to a candidate
RiskTier. No state, no hysteresis -- that's hysteresis.py's job. This
file only answers "what tier would this single reading suggest on its
own?"
"""

from __future__ import annotations

from schemas.schemas import RiskLevel, RiskTier

_LEVEL_TO_TIER = {
    RiskLevel.LOW: RiskTier.GREEN,
    RiskLevel.MODERATE: RiskTier.YELLOW,
    RiskLevel.HIGH: RiskTier.RED,
}

# Ordinal severity, used by hysteresis.py to compare tiers.
TIER_ORDER = {RiskTier.GREEN: 0, RiskTier.YELLOW: 1, RiskTier.RED: 2}


def candidate_tier(risk_level: RiskLevel) -> RiskTier:
    return _LEVEL_TO_TIER[risk_level]