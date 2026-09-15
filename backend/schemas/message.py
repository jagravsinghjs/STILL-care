from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

class MessageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    patient_id: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=2000)
    @field_validator('content')
    @classmethod
    def nonempty(cls, value):
        if not value.strip(): raise ValueError('Content is required')
        return value.strip()

class MessageResponse(BaseModel):
    id: str
    patient_id: str
    sender_id: str
    receiver_id: str
    sender: Literal['user','supervisor']
    content: str
    created_at: datetime
    read_at: datetime | None
