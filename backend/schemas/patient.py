from datetime import datetime
from pydantic import BaseModel
from .checkin import State, Trend

class PatientResponse(BaseModel):
    id: str
    name: str
    initials: str
    context: str
    supervisor_id: str
    last_checkin: datetime | None
    attention_state: State | None
    trend: Trend
    summary: str
