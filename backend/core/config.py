import os
import secrets
from pathlib import Path
from dataclasses import dataclass, field
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / 'backend' / '.env')

@dataclass
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv('DATABASE_URL', 'sqlite:///' + str(ROOT / 'backend' / 'data' / 'still.db')))
    mode: str = field(default_factory=lambda: os.getenv('BACKEND_MODE', 'mock'))
    jwt_secret: str = field(default_factory=lambda: os.getenv('JWT_SECRET') or secrets.token_urlsafe(48))
    signup_supervisor_id: str = field(default_factory=lambda: os.getenv('SIGNUP_SUPERVISOR_ID', 'meera'))
    assistant_model: str = field(default_factory=lambda: os.getenv('ASSISTANT_MODEL', 'qwen2.5:7b-instruct'))
    token_minutes: int = 60
    origins: list[str] = field(default_factory=lambda: [s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174').split(',') if s.strip()])
    max_audio_bytes: int = 10 * 1024 * 1024
    pipeline_timeout: int = 180

    def __post_init__(self):
        if self.mode not in ('mock', 'integrated'):
            raise ValueError('BACKEND_MODE must be mock or integrated')
        if len(self.jwt_secret) < 32:
            raise ValueError('JWT_SECRET must contain at least 32 characters')
        if '*' in self.origins:
            raise ValueError('Explicit CORS origins required')
