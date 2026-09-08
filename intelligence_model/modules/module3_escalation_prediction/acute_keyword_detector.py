"""
modules/module3_escalation_prediction/acute_keyword_detector.py

Module 3 -- lightweight, auditable keyword/phrase matcher over transcript
text, producing the acute_override boolean. Deliberately NOT ML-based:
this is a safety-critical override (acute_override forces risk_score=100
and RiskLevel.HIGH downstream, unconditionally), so it needs to be
something a clinician can read top-to-bottom and audit, not a black box.

STARTER LIST ONLY. See this module's README.md for what a clinical
reviewer needs to change before this runs against real patients.
"""

from __future__ import annotations

# Grouped for readability/auditability, not for different handling --
# any single match anywhere in this list triggers acute_override.
_ACUTE_PHRASES: list[str] = [
    # Direct suicidal ideation
    "want to die",
    "wish i was dead",
    "wish i were dead",
    "kill myself",
    "end my life",
    "end it all",
    "no reason to live",
    "better off dead",
    "not want to be alive",
    "don't want to be alive",
    "planning to die",

    # Self-harm intent
    "hurt myself",
    "harm myself",
    "cut myself",
    "going to hurt myself",

    # Acute hopelessness / no way out framing
    "no way out",
    "can't go on",
    "cannot go on",
    "nothing left to live for",
    "no point in living",

    # Violent ideation toward others (relevant given the patient population
    # this system serves -- atrocity-act victims may express both
    # self-directed and other-directed acute distress)
    "going to kill",
    "going to hurt them",
]


def find_acute_matches(transcript: str) -> list[str]:
    """
    Returns every phrase from _ACUTE_PHRASES found in `transcript`
    (case-insensitive substring match). Empty list if none matched.

    Exposed separately from detect_acute_risk() so callers that want an
    audit trail (e.g. logging exactly what triggered an override, for a
    supervisor reviewing an alert) can get it without re-scanning.
    """
    lowered = transcript.lower()
    return [phrase for phrase in _ACUTE_PHRASES if phrase in lowered]


def detect_acute_risk(transcript: str) -> bool:
    """True if any acute-risk phrase is found anywhere in `transcript`."""
    return bool(find_acute_matches(transcript))