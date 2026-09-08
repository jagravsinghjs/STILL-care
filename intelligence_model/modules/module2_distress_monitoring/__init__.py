"""
Module 12 (Dynamic Distress Monitoring) -- package entry point.

Consumes: a patient's historical SessionSummary rows.
Produces: one persisted DistressTrend per computation.
Sign convention: DistressTrend.slope is negative when worsening, positive
when improving (see trend_engine.py's docstring for why).
"""

from __future__ import annotations

from .trend_engine import compute_trend

__all__ = ["compute_trend"]