"""
Module 11 (Session Analysis) -- package entry point.

Consumes: a finished session's raw turns (via db/repository.py).
Produces: a persisted SessionSummary, and on request, a PDF report.
Nothing predictive happens here -- Module 12 onward own trend/risk.
"""

from __future__ import annotations

from .aggregator import analyze_session
from .report_generator import generate_report

__all__ = ["analyze_session", "generate_report"]