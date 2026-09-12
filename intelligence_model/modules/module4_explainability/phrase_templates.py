"""
modules/module4_explainability/phrase_templates.py

Maps feature names/value ranges to natural-language templates, kept as
data (not inline strings in explainer.py) so wording can be reviewed and
edited without touching logic -- per architecture.md's explicit intent
for this file.

Bucket thresholds here are wording choices, not safety-relevant decisions
(they don't affect risk_score, risk_level, or tier -- purely how the
explanation reads to a supervisor). Easy to retune independently of
everything else in Modules 11-13.
"""

from __future__ import annotations


def trend_slope_phrase(slope: float, window_sessions: int | None = None) -> str:
    """
    slope follows Module 12's convention: negative = worsening, positive
    = improving. window_sessions, if known, is woven in for a more
    concrete phrase (matches architecture.md's own example: "Three
    sessions of worsening trend").
    """
    if slope <= -3.0:
        severity = "a clearly worsening"
    elif slope <= -1.5:
        severity = "a worsening"
    elif slope < 1.5:
        severity = "a relatively stable"
    elif slope < 3.0:
        severity = "an improving"
    else:
        severity = "a clearly improving"

    if window_sessions is not None and window_sessions >= 2:
        return f"{severity.capitalize()} trend across the last {window_sessions} sessions."
    return f"{severity.capitalize()} trend across recent sessions."


def session_mean_score_phrase(value: float) -> str:
    if value <= 40.0:
        level = "low"
    elif value <= 65.0:
        level = "moderate"
    else:
        level = "high"
    return f"This session's overall distress level was {level}."


def recent_volatility_phrase(value: float) -> str:
    if value < 10.0:
        return "Emotional responses were fairly consistent within this session."
    if value < 25.0:
        return "Emotional responses fluctuated noticeably within this session."
    return "Emotional responses were highly volatile within this session."


def acute_override_phrase() -> str:
    return (
        "Language in this session matched known acute-risk phrases and "
        "triggered an immediate high-risk flag, independent of every "
        "other signal."
    )


# Dispatch table keyed by ContributingFeature.name (see risk_aggregation.cpp).
# Each entry is a callable taking (value, window_sessions) -> str; entries
# that don't need window_sessions just ignore it.
_TEMPLATES = {
    "trend_slope": lambda value, window_sessions: trend_slope_phrase(value, window_sessions),
    "session_mean_score": lambda value, window_sessions: session_mean_score_phrase(value),
    "recent_volatility": lambda value, window_sessions: recent_volatility_phrase(value),
    "acute_override": lambda value, window_sessions: acute_override_phrase(),
}


def phrase_for(feature_name: str, value: float, window_sessions: int | None = None) -> str:
    """
    Falls back to a generic templated sentence for any feature name not
    in _TEMPLATES, rather than raising -- so a future new feature from
    risk_aggregation.cpp degrades gracefully instead of breaking
    explain_risk() entirely.
    """
    template = _TEMPLATES.get(feature_name)
    if template is not None:
        return template(value, window_sessions)
    return f"{feature_name.replace('_', ' ').capitalize()}: {value:.2f}."