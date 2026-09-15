"""
Module 13 (Distress Escalation Prediction) -- package entry point.

Consumes: latest DistressTrend + triggering session's SessionSummary +
that session's transcript text.
Produces: one persisted EscalationRisk per assessment.

Currently the heuristic path only (heuristic_model.py). trained_model.py
and train/ are deferred until real/synthetic training data exists --
see README.md.
"""

from __future__ import annotations

from .heuristic_model import assess_risk

__all__ = ["assess_risk"]