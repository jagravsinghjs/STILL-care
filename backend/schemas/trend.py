from datetime import datetime
from pydantic import BaseModel
from .checkin import State, Trend
class TrendPoint(BaseModel):
    checkin_id: str
    created_at: datetime
    attention_state: State
    trend: Trend
