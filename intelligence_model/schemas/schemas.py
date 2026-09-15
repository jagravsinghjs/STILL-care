"""
Data contracts for Setu's Monitoring & Intelligence layer (Modules 11-17).

These are the shapes flowing:
  Modules 6-9 (AI pipeline)  ->  Module 11  ->  Module 12  ->  Module 13
                                                                  |
                                                        +---------+---------+
                                                        |                   |
                                                    Module 14           Module 15
                                                                            |
                                                                +-----------+-----------+
                                                                |                       |
                                                            Module 16               Module 17
                                                                |                       |
                                                                +-----------+-----------+
                                                                            |
                                                                    Supervisor portal

Keep this file as the single source of truth for these shapes. If Module 13's
internals change from a heuristic to a trained model later, EscalationRisk's
external shape should not need to change -- only how it's populated.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ArousalLabel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class TrendLabel(str, Enum):
    IMPROVING = "improving"
    STABLE = "stable"
    WORSENING = "worsening"
    INSUFFICIENT_DATA = "insufficient_data"


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class RiskTier(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class InterventionCategory(str, Enum):
    COUNSELLING = "counselling"
    MEDICAL = "medical"
    LEGAL_AID = "legal_aid"
    PROTECTION_RELOCATION = "protection_relocation"
    FINANCIAL_ASSISTANCE = "financial_assistance"


class AlertStatus(str, Enum):
    UNACKNOWLEDGED = "unacknowledged"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


# ---------------------------------------------------------------------------
# Inputs from Modules 6-9 (per turn)
# ---------------------------------------------------------------------------

class ArousalFeatures(BaseModel):
    pitch_mean: float
    pitch_std: float
    energy: float
    zero_crossing_rate: float
    pause_ratio: float
    arousal_label: ArousalLabel


class EmotionScores(BaseModel):
    anger: float = Field(ge=0, le=1)
    disgust: float = Field(ge=0, le=1)
    fear: float = Field(ge=0, le=1)
    joy: float = Field(ge=0, le=1)
    neutral: float = Field(ge=0, le=1)
    sadness: float = Field(ge=0, le=1)
    surprise: float = Field(ge=0, le=1)


class TurnRecord(BaseModel):
    """One conversational turn, as handed off by Module 9."""
    turn_id: str
    session_id: str
    patient_id: str
    timestamp: datetime
    transcript: str
    arousal: ArousalFeatures
    emotion: EmotionScores


# ---------------------------------------------------------------------------
# Module 11 -- Session Analysis & Report
# ---------------------------------------------------------------------------

class TurnScore(BaseModel):
    turn_id: str
    timestamp: datetime
    score: float = Field(ge=0, le=100)
    flagged_high_pause: bool = False  # surfaced separately, not folded into score


class SessionSummary(BaseModel):
    session_id: str
    patient_id: str
    start_time: datetime
    end_time: datetime
    turn_count: int
    mean_score: float = Field(ge=0, le=100)
    max_score: float = Field(ge=0, le=100)
    min_score: float = Field(ge=0, le=100)
    volatility: float = Field(ge=0)          # std dev of turn scores
    within_session_trend: float              # slope, first-third vs last-third
    timeline: list[TurnScore]


# ---------------------------------------------------------------------------
# Module 12 -- Dynamic Distress Monitoring
# ---------------------------------------------------------------------------

class DistressTrend(BaseModel):
    patient_id: str
    computed_at: datetime
    window_sessions: int             # how many recent sessions this covers
    slope: float                     # score change per day, time-weighted
    trend_label: TrendLabel
    confidence: float = Field(ge=0, le=1)   # lower with fewer data points


# ---------------------------------------------------------------------------
# Module 13 -- Distress Escalation Prediction
# ---------------------------------------------------------------------------

class ContributingFeature(BaseModel):
    name: str                # e.g. "trend_slope", "recent_volatility", "acute_keyword"
    value: float
    weight: float             # contribution to the final risk_score


class EscalationRisk(BaseModel):
    patient_id: str
    session_id: str           # the session that triggered this assessment
    assessed_at: datetime
    risk_score: float = Field(ge=0, le=100)   # continuous underlying score
    risk_level: RiskLevel
    acute_override: bool = False              # e.g. crisis-keyword match
    contributing_features: list[ContributingFeature]


# ---------------------------------------------------------------------------
# Module 14 -- Explainable Risk Assessment
# ---------------------------------------------------------------------------

class ExplanationFactor(BaseModel):
    description: str          # plain-language, e.g. "Three sessions of worsening trend"
    contribution: float       # relative weight, for ranking factors shown to supervisor


class RiskExplanation(BaseModel):
    patient_id: str
    session_id: str
    generated_at: datetime
    top_factors: list[ExplanationFactor]   # ordered, highest contribution first


# ---------------------------------------------------------------------------
# Module 15 -- Status & Risk Classification
# ---------------------------------------------------------------------------

class RiskStatus(BaseModel):
    patient_id: str
    tier: RiskTier
    tier_since: datetime
    previous_tier: Optional[RiskTier] = None
    consecutive_high_assessments: int = 0   # for hysteresis before flipping to RED


# ---------------------------------------------------------------------------
# Module 16 -- Alert & Escalation
# ---------------------------------------------------------------------------

class Alert(BaseModel):
    alert_id: str
    patient_id: str
    triggered_at: datetime
    tier: RiskTier
    reason: str
    status: AlertStatus = AlertStatus.UNACKNOWLEDGED
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Module 17 -- Intervention Recommendation
# ---------------------------------------------------------------------------

class InterventionRecommendation(BaseModel):
    recommendation_id: str
    patient_id: str
    generated_at: datetime
    categories: list[InterventionCategory]
    rationale: list[str]          # human-readable reasons per category, aligned by index
    reviewed_by: Optional[str] = None
    accepted: Optional[bool] = None   # None = pending human review
