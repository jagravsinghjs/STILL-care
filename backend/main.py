"""HTTP entry point for the STILL-care main backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .auth import (
    AuthenticationError,
    DuplicateAccountError,
    RegistrationError,
    authenticate,
    decode_access_token,
    issue_access_token,
    register_student,
)
from .database import initialize_schema, transaction
from .case_context import save_case_context
from .read_models import report_for_patient, report_for_supervisor, status_for, trend_for
from .chat_service import end_session, generate_and_persist_reply, owned_open_session, persist_turn, process_audio, start_session


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_schema()
    yield


app = FastAPI(title="STILL-care API", lifespan=lifespan)
bearer_scheme = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    name: str = Field(max_length=80)
    user_id: str = Field(max_length=40)
    password: str = Field(min_length=8)


class IdentityResponse(BaseModel):
    id: str
    name: str
    role: str


class LoginRequest(BaseModel):
    # The frontend calls this field "email" today, but it contains the User ID.
    email: str = Field(max_length=40)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: IdentityResponse


class CaseContextRequest(BaseModel):
    case_details: str = Field(min_length=1, max_length=20_000)


class CaseContextResponse(BaseModel):
    updated: bool


class StatusResponse(BaseModel):
    tier: str
    assessed_at: str | None


class TrendPoint(BaseModel):
    computed_at: str
    trend_label: str
    slope: float
    confidence: float
    window_sessions: int


class StartSessionResponse(BaseModel):
    session_id: str


class TurnResponse(BaseModel):
    turn_id: str
    transcript: str
    reply: str


def current_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> IdentityResponse:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer authentication is required.")
    try:
        claims = decode_access_token(credentials.credentials)
    except (AuthenticationError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.") from exc
    return IdentityResponse(id=str(claims["sub"]), name="", role=str(claims["role"]))


def authorize_patient_read(conn, identity: IdentityResponse, patient_id: str) -> None:
    if identity.role == "STUDENT" and identity.id == patient_id:
        return
    if identity.role == "SUPERVISOR":
        assigned = conn.execute(
            "SELECT 1 FROM supervisor_patients WHERE supervisor_id = ? AND patient_id = ?", (identity.id, patient_id)
        ).fetchone()
        if assigned:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to access this patient.")


@app.post("/api/auth/register", response_model=IdentityResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> IdentityResponse:
    try:
        with transaction() as conn:
            account = register_student(conn, user_id=payload.user_id, name=payload.name, password=payload.password)
    except DuplicateAccountError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except RegistrationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return IdentityResponse(id=account.user_id, name=account.display_name, role=account.role)


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    try:
        with transaction() as conn:
            account = authenticate(conn, user_id=payload.email, password=payload.password)
        token = issue_access_token(account)
    except AuthenticationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server authentication is not configured.") from exc
    return LoginResponse(
        access_token=token,
        user=IdentityResponse(id=account.user_id, name=account.display_name, role=account.role),
    )


@app.get("/api/auth/me", response_model=IdentityResponse)
def me(identity: IdentityResponse = Depends(current_identity)) -> IdentityResponse:
    with transaction() as conn:
        row = conn.execute(
            "SELECT user_id, display_name, role FROM accounts WHERE user_id = ?", (identity.id,)
        ).fetchone()
    if row is None or row["role"] != identity.role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.")
    return IdentityResponse(id=row["user_id"], name=row["display_name"], role=row["role"])


@app.put("/api/patients/me/case-context", response_model=CaseContextResponse)
def update_case_context(
    payload: CaseContextRequest, identity: IdentityResponse = Depends(current_identity)
) -> CaseContextResponse:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only patient accounts may update case context.")
    with transaction() as conn:
        row = conn.execute("SELECT display_name FROM accounts WHERE user_id = ?", (identity.id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.")
        try:
            save_case_context(conn, patient_id=identity.id, display_name=row["display_name"], text=payload.case_details)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Case context could not be processed. Please try again.") from exc
    return CaseContextResponse(updated=True)


@app.post("/api/chat/sessions", response_model=StartSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat_session(identity: IdentityResponse = Depends(current_identity)) -> dict:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    with transaction() as conn:
        return {"session_id": start_session(conn, identity.id)}


@app.post("/api/chat/sessions/{session_id}/turns", response_model=TurnResponse)
async def upload_audio_turn(session_id: str, audio: UploadFile = File(...), identity: IdentityResponse = Depends(current_identity)) -> dict:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    content = await audio.read(25 * 1024 * 1024 + 1)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio uploads are limited to 25 MB.")
    suffix = Path(audio.filename or "recording.webm").suffix or ".webm"
    try:
        transcript, arousal, emotion = process_audio(content, suffix)
        with transaction() as conn:
            if owned_open_session(conn, identity.id, session_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Open session not found.")
            turn_id = persist_turn(conn, session_id=session_id, patient_id=identity.id, transcript=transcript, arousal=arousal, emotion=emotion)
            reply = generate_and_persist_reply(conn, session_id=session_id, patient_id=identity.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="The assistant is temporarily unavailable. Please try again.") from exc
    return {"turn_id": turn_id, "transcript": transcript, "reply": reply}


@app.post("/api/chat/sessions/{session_id}/end")
def finish_chat_session(session_id: str, identity: IdentityResponse = Depends(current_identity)) -> dict:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    with transaction() as conn:
        if owned_open_session(conn, identity.id, session_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Open session not found.")
        try:
            end_session(conn, session_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"session_id": session_id, "ended": True}


@app.get("/api/patients/me/status", response_model=StatusResponse)
def patient_status(identity: IdentityResponse = Depends(current_identity)) -> dict:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    with transaction() as conn:
        return status_for(conn, identity.id)


@app.get("/api/patients/me/trend", response_model=list[TrendPoint])
def patient_trend(identity: IdentityResponse = Depends(current_identity)) -> list[dict]:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    with transaction() as conn:
        return trend_for(conn, identity.id)


@app.get("/api/patients/me/sessions/{session_id}/report")
def patient_report(session_id: str, identity: IdentityResponse = Depends(current_identity)) -> dict:
    if identity.role != "STUDENT":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient access is required.")
    with transaction() as conn:
        report = report_for_patient(conn, identity.id, session_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No report is available for this session.")
    return report


@app.get("/api/supervisor/patients/{patient_id}/status", response_model=StatusResponse)
def supervisor_status(patient_id: str, identity: IdentityResponse = Depends(current_identity)) -> dict:
    with transaction() as conn:
        authorize_patient_read(conn, identity, patient_id)
        return status_for(conn, patient_id)


@app.get("/api/supervisor/patients/{patient_id}/trend", response_model=list[TrendPoint])
def supervisor_trend(patient_id: str, identity: IdentityResponse = Depends(current_identity)) -> list[dict]:
    with transaction() as conn:
        authorize_patient_read(conn, identity, patient_id)
        return trend_for(conn, patient_id)


@app.get("/api/supervisor/patients/{patient_id}/sessions/{session_id}/report")
def supervisor_report(patient_id: str, session_id: str, identity: IdentityResponse = Depends(current_identity)) -> dict:
    with transaction() as conn:
        authorize_patient_read(conn, identity, patient_id)
        report = report_for_supervisor(conn, patient_id, session_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No report is available for this session.")
    return report
