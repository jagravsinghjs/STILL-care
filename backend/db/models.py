from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Text, ForeignKey, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator
from .database import Base

def now(): return datetime.now(timezone.utc)
def uid(): return str(uuid4())

class UTCDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True
    def process_bind_param(self, value, dialect):
        return value.astimezone(timezone.utc).replace(tzinfo=None) if value else None
    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value else None

class User(Base):
    __tablename__ = 'app_users'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str]
    role: Mapped[str]
    password_hash: Mapped[str]

class SupervisorProfile(Base):
    __tablename__ = 'app_supervisors'
    id: Mapped[str] = mapped_column(ForeignKey('app_users.id'), primary_key=True)
    user: Mapped[User] = relationship()
    patients: Mapped[list['PatientProfile']] = relationship(back_populates='supervisor')

class PatientProfile(Base):
    __tablename__ = 'app_patients'
    id: Mapped[str] = mapped_column(ForeignKey('app_users.id'), primary_key=True)
    supervisor_id: Mapped[str] = mapped_column(ForeignKey('app_supervisors.id'), index=True)
    context: Mapped[str] = mapped_column(default='Personal wellbeing')
    user: Mapped[User] = relationship()
    supervisor: Mapped[SupervisorProfile] = relationship(back_populates='patients')
    checkins: Mapped[list['CheckInSession']] = relationship(back_populates='patient')
    messages: Mapped[list['Message']] = relationship(back_populates='patient')
    alerts: Mapped[list['Alert']] = relationship(back_populates='patient')
    actions: Mapped[list['SupervisorAction']] = relationship(back_populates='patient')

class CheckInSession(Base):
    __tablename__ = 'app_checkins'
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey('app_patients.id'), index=True)
    mode: Mapped[str]
    raw_reflection: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    patient: Mapped[PatientProfile] = relationship(back_populates='checkins')
    report: Mapped['Report'] = relationship(back_populates='checkin', uselist=False)
    observation: Mapped['ContinuityObservation'] = relationship(back_populates='checkin', uselist=False)

class Report(Base):
    __tablename__ = 'app_reports'
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    checkin_id: Mapped[str] = mapped_column(ForeignKey('app_checkins.id'), unique=True)
    structured: Mapped[dict] = mapped_column(JSON)
    processing_mode: Mapped[str]
    checkin: Mapped[CheckInSession] = relationship(back_populates='report')

class ContinuityObservation(Base):
    __tablename__ = 'app_observations'
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    checkin_id: Mapped[str] = mapped_column(ForeignKey('app_checkins.id'), unique=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey('app_patients.id'), index=True)
    attention_state: Mapped[str]
    trend: Mapped[str]
    summary: Mapped[str] = mapped_column(Text)
    themes: Mapped[list] = mapped_column(JSON)
    explanation: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    checkin: Mapped[CheckInSession] = relationship(back_populates='observation')

class Alert(Base):
    __tablename__ = 'app_alerts'
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey('app_patients.id'), index=True)
    checkin_id: Mapped[str] = mapped_column(ForeignKey('app_checkins.id'), unique=True)
    attention_state: Mapped[str]
    priority: Mapped[str]
    reason: Mapped[str] = mapped_column(default='Supervisor attention recommended')
    status: Mapped[str] = mapped_column(default='open')
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    patient: Mapped[PatientProfile] = relationship(back_populates='alerts')

class Message(Base):
    __tablename__ = 'app_messages'
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey('app_patients.id'), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey('app_users.id'))
    receiver_id: Mapped[str] = mapped_column(ForeignKey('app_users.id'))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    read_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    patient: Mapped[PatientProfile] = relationship(back_populates='messages')

class SupervisorAction(Base):
    __tablename__ = 'app_actions'
    id: Mapped[str] = mapped_column(primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey('app_patients.id'), index=True)
    supervisor_id: Mapped[str] = mapped_column(ForeignKey('app_supervisors.id'))
    action: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=now)
    patient: Mapped[PatientProfile] = relationship(back_populates='actions')
