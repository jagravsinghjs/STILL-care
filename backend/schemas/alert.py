from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from .checkin import State

class AlertResponse(BaseModel):
    id: str
    patient_id: str
    checkin_id: str
    attention_state: State
    priority: Literal['normal','high']
    reason: str
    status: Literal['open','acknowledged','resolved']
    created_at: datetime

class AlertUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['acknowledged','resolved']

class ActionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    patient_id: str = Field(min_length=1,max_length=100)
    action: Literal['reviewed','contacted','follow_up_planned']

class ActionResponse(ActionRequest):
    id: str
    supervisor_id: str
    created_at: datetime
