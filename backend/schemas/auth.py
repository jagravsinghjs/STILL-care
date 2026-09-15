from pydantic import BaseModel, Field, ConfigDict
from typing import Literal

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

class UserResponse(BaseModel):
    id: str
    name: str
    role: Literal['STUDENT','SUPERVISOR']

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserResponse

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    user_id: str = Field(min_length=3, max_length=40, pattern=r'^[a-zA-Z0-9._-]+$')
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=256)
