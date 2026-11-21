"""
modules/module6_alerting/alert_engine.py

Module 16 -- the only module permitted to write to `alerts`. Watches
risk_status before/after a Module 15 update plus the triggering
EscalationRisk's acute_override flag, and decides whether/what to alert.
Detect + notify only -- never acts autonomously, matching the PS's
requirement that alerts go to humans.

Alert.reason carries [REVIEW], [ESCALATION], [ACUTE], or [PROGRESS]. The
computed Alert.priority exposes urgency to API/relay consumers without
altering existing database columns or conflating it with the long-term tier.

Review rules do not require a tier change or previous session. Stored turns
are checked during ingestion for high numeric distress and explicit severe
distress/harm/coercion language. Session-end risk can also request review.
One deterministic attention alert is kept per session and upgraded if needed;
the long-term tier retains its existing hysteresis. These are prototype
heuristics for human review, not clinical findings or comprehensive detection.
"""

from __future__ import annotations

import uuid
import re
from datetime import datetime, timezone
from typing import Optional

from db.repository import insert_alert, get_session, get_risk_status, get_turns_for_session, upsert_session_review_alert
from modules.module1_session_analysis.aggregator import score_turn
from modules.module3_escalation_prediction.acute_keyword_detector import find_acute_matches
from modules.module5_risk_classification.tier_classifier import TIER_ORDER
from schemas.schemas import Alert, EscalationRisk, RiskStatus, RiskLevel, RiskTier
from .notifier import notify_alertd


# Prototype review triggers, not diagnostic cutoffs. No history is required.
HIGH_TURN_SCORE = 65.0
_REVIEW_PATTERNS = [
    ("physical_harm", "reported physical harm", "urgent",
     r"\b(?:hit|hits|hitting|hurt|hurts|hurting|beat|beats|beating|assaulted|chased|chasing)\s+me\b"),
    ("threat", "reported threats", "urgent",
     r"\b(?:threatened|threatens|threatening)\s+me\b"),
    ("coercion", "reported bullying or coercion", "prompt",
     r"\b(?:(?:bullying|bullies|bully)\s+me|(?:force|forces|forced|forcing)\s+(?:me|everything\s+on\s+me))\b"),
    ("personal_harm", "reported being harmed, threatened, or forced", "urgent",
     r"\bi(?:['’]m|\s+am|\s+was|\s+have\s+been)\s+(?:being\s+)?(?:hit|bullied|threatened|forced|chased)\b"),
    ("following", "reported being followed", "prompt",
     r"\b(?:following|followed)\s+me\b"),
    ("severe_distress", "reported severe distress or difficulty coping", "urgent",
     r"\bi(?:['’]m|\s+am|\s+feel|\s+have\s+been)?\s+(?:so|very|extremely|severely)\s+(?:stressed|overwhelmed|distressed|scared|frightened)\b|\bi\s+(?:can't|cannot|can\s+not)\s+(?:cope|handle\s+(?:this|it))\b|\bi(?:['’]m|\s+am)\s+panicking\b"),
]
_NEGATED_PREFIX = re.compile(
    r"\b(?:not|never|no\s+longer|nobody|no\s+one|don't|doesn't|didn't|hasn't|haven't|isn't|aren't)\s+"
    r"(?:(?:been|being|ever|actually|really|currently)\s+){0,2}$", re.IGNORECASE)


def _review_evidence(session_id, conn=None, risk=None):
    turns = get_turns_for_session(session_id, conn=conn)
    findings, quotes = {}, []
    peak = max((score_turn(turn).score for turn in turns), default=0.0)
    if peak > HIGH_TURN_SCORE:
        findings["high_turn_score"] = (f"a high numerical turn score ({peak:.1f}/100)", "urgent")
    for turn in turns:
        for code, description, urgency, pattern in _REVIEW_PATTERNS:
            for match in re.finditer(pattern, turn.transcript, re.IGNORECASE):
                prefix = turn.transcript[max(0, match.start() - 70):match.start()]
                if _NEGATED_PREFIX.search(prefix):
                    continue
                findings[code] = (description, urgency)
                if match.group(0) not in quotes:
                    quotes.append(match.group(0))
        matches = find_acute_matches(turn.transcript)
        if matches:
            findings["acute"] = ("configured acute-risk language", "urgent")
            quotes.extend(phrase for phrase in matches if phrase not in quotes)
    if risk is not None:
        if risk.acute_override:
            findings["acute"] = ("configured acute-risk language", "urgent")
        elif risk.risk_level in (RiskLevel.MODERATE, RiskLevel.HIGH):
            findings["session_risk"] = (
                f"a {risk.risk_level.value} current-session risk assessment",
                "urgent" if risk.risk_level == RiskLevel.HIGH else "prompt",
            )
    return findings, quotes


def _review_reason(patient_id, session_id, findings, quotes):
    urgency = "urgent" if any(item[1] == "urgent" for item in findings.values()) else "prompt"
    descriptions = "; ".join(item[0] for item in findings.values())
    evidence = " Evidence: " + "; ".join(repr(quote) for quote in quotes[:3]) + "." if quotes else ""
    return (f"[REVIEW] [{urgency.upper()}] Patient {patient_id} needs a supervisor check-in "
            f"{'now' if urgency == 'urgent' else 'promptly'}. This session contains {descriptions}."
            f"{evidence} Review the reported situation and support needs; this is a prototype "
            f"review signal, not a diagnosis or verified finding. Session: {session_id}.")


def _save_session_attention(patient_id, session_id, tier, reason, conn=None, new_only=False):
    alert = Alert(
        alert_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"still-care:session-review:{patient_id}:{session_id}")),
        patient_id=patient_id, triggered_at=datetime.now(timezone.utc), tier=tier, reason=reason,
    )
    stored, should_notify = upsert_session_review_alert(alert, conn=conn)
    if should_notify:
        notify_alertd(stored)
    return stored if should_notify or not new_only else None


def check_session_review(session_id: str, conn=None) -> Optional[Alert]:
    """Check already-stored turns immediately, even before the session ends."""
    session = get_session(session_id, conn=conn)
    if session is None:
        return None
    findings, quotes = _review_evidence(session_id, conn=conn)
    if not findings:
        return None
    current = get_risk_status(session["patient_id"], conn=conn)
    tier = current.tier if current else RiskTier.GREEN
    reason = _review_reason(session["patient_id"], session_id, findings, quotes)
    if "acute" in findings:
        reason = "[ACUTE] " + reason.removeprefix("[REVIEW] ")
    return _save_session_attention(session["patient_id"], session_id, tier, reason, conn=conn, new_only=True)


def _escalation_reason(old_tier, new_tier) -> str:
    return f"[ESCALATION] Risk tier increased from {old_tier.value} to {new_tier.value}."


def _progress_reason(old_tier, new_tier) -> str:
    return (
        f"[PROGRESS] Encouraging news: risk tier improved from {old_tier.value} "
        f"to {new_tier.value}. Recent sessions show sustained improvement."
    )


def _acute_reason(session_id: str, tier_changed: bool, new_tier) -> str:
    if tier_changed:
        return (
            f"[ACUTE] Immediate high-risk language detected in session {session_id}, "
            f"escalating tier to {new_tier.value}."
        )
    return (
        f"[ACUTE] Immediate high-risk language detected in session {session_id} "
        f"while already at {new_tier.value} tier -- re-flagged for review."
    )


def check_and_alert(
    risk: EscalationRisk,
    old_status: Optional[RiskStatus],
    new_status: RiskStatus,
    conn=None,
) -> Optional[Alert]:
    """
    Compares old_status -> new_status (Module 15's before/after) plus
    risk.acute_override, inserts an Alert if warranted, and best-effort
    notifies alertd. Returns the Alert if one was created, else None.
    """
    tier_changed = old_status is not None and old_status.tier != new_status.tier
    findings, quotes = _review_evidence(risk.session_id, conn=conn, risk=risk)

    if risk.acute_override:
        if old_status is None:
            reason = f"[ACUTE] Immediate high-risk language detected in first assessment session {risk.session_id}."
        else:
            reason = _acute_reason(risk.session_id, tier_changed, new_status.tier)
        reason += f" Patient {risk.patient_id} needs immediate supervisor review."
    elif tier_changed and TIER_ORDER[new_status.tier] > TIER_ORDER[old_status.tier]:
        reason = _escalation_reason(old_status.tier, new_status.tier)
        if findings:
            reason += " " + _review_reason(risk.patient_id, risk.session_id, findings, quotes).removeprefix("[REVIEW] ")
    elif findings:
        reason = _review_reason(risk.patient_id, risk.session_id, findings, quotes)
    elif not tier_changed:
        return None
    else:
        reason = _progress_reason(old_status.tier, new_status.tier)

    if not reason.startswith("[PROGRESS]"):
        return _save_session_attention(risk.patient_id, risk.session_id, new_status.tier, reason, conn=conn)

    alert = Alert(
        alert_id=str(uuid.uuid4()),
        patient_id=risk.patient_id,
        triggered_at=datetime.now(timezone.utc),
        tier=new_status.tier,
        reason=reason,
    )
    insert_alert(alert, conn=conn)
    notify_alertd(alert)  # best-effort; failure here never undoes the insert above
    return alert
