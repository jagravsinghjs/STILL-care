from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

State = Literal['GREEN', 'YELLOW', 'RED']
Trend = Literal['IMPROVING', 'WORSENING', 'NO_CLEAR_CHANGE']

class CheckInRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    patient_id: str = Field(min_length=1, max_length=100)
    mode: Literal['written', 'voice'] = 'written'
    content: str = Field(min_length=1, max_length=10000)
    @field_validator('content')
    @classmethod
    def nonempty(cls, value):
        if not value.strip(): raise ValueError('Content is required')
        return value.strip()

class SupervisorSessionSummary(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str
    patient_id: str
    status: Literal['processed'] = 'processed'
    mode: Literal['written','voice']
    created_at: datetime
    attention_state: State
    trend: Trend
    summary: str
    themes: list[str]
    explanation: str
    recommended_action: str
    processing_mode: Literal['mock','integrated']

class PatientCheckInResponse(SupervisorSessionSummary):
    raw_reflection: str
