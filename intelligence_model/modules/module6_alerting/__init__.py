"""
Module 16 (Alert & Escalation) -- package entry point.

Checks current turns during ingestion and risk/status at session end.
Creates an early review alert without waiting for history or a tier change.
Detect + notify only -- never autonomous intervention.
"""

from __future__ import annotations

from .alert_engine import check_and_alert, check_session_review

__all__ = ["check_and_alert", "check_session_review"]
