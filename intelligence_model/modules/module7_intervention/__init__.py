"""
Module 17 (Intervention Recommendation) -- package entry point.

Consumes: a patient's current RiskStatus + acute_override flag (+
optionally RiskExplanation).
Produces: zero or one persisted InterventionRecommendation, always
accepted=None -- a proposal for a supervisor to accept or dismiss, never
auto-applied.
"""

from __future__ import annotations

from .recommender import recommend_interventions

__all__ = ["recommend_interventions"]