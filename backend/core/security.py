from datetime import datetime, timedelta, timezone
from typing import Annotated
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.db.models import User, PatientProfile

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)

def hash_password(password): return hasher.hash(password)
def verify_password(password, encoded):
    try: return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError): return False

def db_session(request: Request):
    with request.app.state.sessions() as db:
        yield db
DB = Annotated[Session, Depends(db_session)]

def current_user(request: Request, db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    try:
        if not credentials: raise ValueError()
        data = jwt.decode(credentials.credentials, request.app.state.settings.jwt_secret, algorithms=['HS256'], audience='still-care', issuer='still-care', options={'require':['exp','sub','iat','aud','iss']})
        user = db.get(User, data['sub'])
        if not user: raise ValueError()
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, 'Authentication required') from None
Current = Annotated[User, Depends(current_user)]

def supervisor_only(user: Current):
    if user.role != 'SUPERVISOR': raise HTTPException(403, 'Supervisor access required')
    return user
Supervisor = Annotated[User, Depends(supervisor_only)]

def authorize_patient(db, user, patient_id, private=False):
    patient = db.get(PatientProfile, patient_id)
    if not patient: raise HTTPException(404, 'Record not found')
    owner = user.role == 'STUDENT' and user.id == patient.id
    assigned = user.role == 'SUPERVISOR' and user.id == patient.supervisor_id
    if not owner and not (assigned and not private): raise HTTPException(403, 'Access denied')
    return patient

def issue_token(user, settings):
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub':user.id,'iat':now,'exp':now+timedelta(minutes=settings.token_minutes),'aud':'still-care','iss':'still-care'},settings.jwt_secret,algorithm='HS256')
