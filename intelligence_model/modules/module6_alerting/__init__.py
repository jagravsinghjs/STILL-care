"""
Module 16 (Alert & Escalation) -- package entry point.

Consumes: an EscalationRisk + the patient's RiskStatus before/after
Module 15's update.
Produces: zero or one persisted Alert per assessment, best-effort pushed
to alertd. Detect + notify only -- never autonomous action.
"""

from __future__ import annotations

from .alert_engine import check_and_alert

__all__ = ["check_and_alert"]