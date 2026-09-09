"""
Module 14 (Explainable Risk Assessment) -- package entry point.

Consumes: an EscalationRisk (Module 13's output).
Produces: one persisted RiskExplanation -- ranked, plain-language factors
for supervisors. No computation, only translation.
"""

from __future__ import annotations

from .explainer import explain_risk

__all__ = ["explain_risk"]