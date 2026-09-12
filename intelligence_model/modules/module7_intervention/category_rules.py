"""
modules/module7_intervention/category_rules.py

Module 17 -- rule table mapping current signals to candidate
InterventionCategory values + a rationale template for each.

Only COUNSELLING, MEDICAL, and PROTECTION_RELOCATION are implemented.
LEGAL_AID and FINANCIAL_ASSISTANCE are deliberately left out: nothing in
Modules 11-13's current signal set (trend_slope, session_mean_score,
volatility, acute_override) detects either legal or financial distress --
implementing rules for them now would mean inventing triggers with no
real signal behind them. See this module's README for what adding real
support would require.

Rules (locked-in):
- COUNSELLING: tier is YELLOW or RED -- baseline support recommendation
  for any sustained elevated risk.
- MEDICAL: acute_override is True -- acute-risk language warrants a
  medical/psychiatric evaluation, independent of tier.
- PROTECTION_RELOCATION: tier is RED -- gated on sustained high risk
  generally, not specifically on acute_override (a patient can reach RED
  tier purely through hysteresis-driven escalation with no acute flag at
  all, and that alone should still surface this option for review).
"""

from __future__ import annotations

from typing import Callable

from schemas.schemas import InterventionCategory, RiskStatus, RiskTier

# (category, applies(status, acute_override) -> bool, rationale(status, acute_override) -> str)
CategoryRule = tuple[
    InterventionCategory,
    Callable[[RiskStatus, bool], bool],
    Callable[[RiskStatus, bool], str],
]


def _counselling_applies(status: RiskStatus, acute_override: bool) -> bool:
    return status.tier in (RiskTier.YELLOW, RiskTier.RED)


def _counselling_rationale(status: RiskStatus, acute_override: bool) -> str:
    return f"Risk tier is {status.tier.value.upper()} -- continued or new counselling support is recommended."


def _medical_applies(status: RiskStatus, acute_override: bool) -> bool:
    return acute_override


def _medical_rationale(status: RiskStatus, acute_override: bool) -> str:
    return "Acute-risk language was detected in a recent session -- a medical/psychiatric evaluation is recommended."


def _protection_relocation_applies(status: RiskStatus, acute_override: bool) -> bool:
    return status.tier == RiskTier.RED


def _protection_relocation_rationale(status: RiskStatus, acute_override: bool) -> str:
    return (
        "Risk tier is RED, indicating sustained high risk -- protection "
        "and/or relocation options should be reviewed with the patient."
    )


CATEGORY_RULES: list[CategoryRule] = [
    (InterventionCategory.COUNSELLING, _counselling_applies, _counselling_rationale),
    (InterventionCategory.MEDICAL, _medical_applies, _medical_rationale),
    (InterventionCategory.PROTECTION_RELOCATION, _protection_relocation_applies, _protection_relocation_rationale),
]