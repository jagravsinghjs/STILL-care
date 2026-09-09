"""
modules/module7_intervention/recommender.py

Module 17 -- applies category_rules.py against a patient's current
RiskStatus (+ acute_override, carried separately since RiskExplanation's
ExplanationFactor loses the original structured feature name once it's
been turned into prose) to produce an InterventionRecommendation. Never
auto-applied -- accepted is always None, pending human review.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from db.repository import insert_intervention_recommendation
from schemas.schemas import InterventionRecommendation, RiskExplanation, RiskStatus
from .category_rules import CATEGORY_RULES


def recommend_interventions(
    status: RiskStatus,
    acute_override: bool,
    explanation: Optional[RiskExplanation] = None,
    conn=None,
) -> Optional[InterventionRecommendation]:
    """
    `explanation` is accepted for interface parity with architecture.md's
    documented shape (RiskExplanation + RiskStatus) and for future rules
    that might want to inspect specific factor phrasing -- none of the
    three currently-implemented rules use it, since tier + acute_override
    already cover their conditions directly and more reliably than
    parsing generated prose would.

    Returns None (writes nothing) if no rule matches -- e.g. a GREEN-tier
    patient with no acute_override has nothing to recommend.
    """
    categories = []
    rationale = []
    for category, applies, rationale_fn in CATEGORY_RULES:
        if applies(status, acute_override):
            categories.append(category)
            rationale.append(rationale_fn(status, acute_override))

    if not categories:
        return None

    recommendation = InterventionRecommendation(
        recommendation_id=str(uuid.uuid4()),
        patient_id=status.patient_id,
        generated_at=datetime.now(timezone.utc),
        categories=categories,
        rationale=rationale,
        reviewed_by=None,
        accepted=None,  # always pending -- never auto-applied
    )
    insert_intervention_recommendation(recommendation, conn=conn)
    return recommendation