from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from backend.core.security import DB, Current, verify_password, issue_token, hash_password
from backend.db.models import User, PatientProfile, SupervisorProfile
from backend.schemas.auth import LoginRequest, TokenResponse, UserResponse, RegisterRequest

router=APIRouter(prefix='/api/auth',tags=['Authentication'])
# Equal-cost verification for unknown accounts.
DUMMY_HASH=hash_password('unusable-dummy-password')

@router.post('/login',response_model=TokenResponse,description='Public: authenticate using a seeded account.')
def login(body:LoginRequest, request:Request, db:DB):
    user=db.scalar(select(User).where(or_(User.email==body.email.strip().lower(), User.id==body.email.strip().lower())))
    valid=verify_password(body.password,user.password_hash if user else DUMMY_HASH)
    if not valid or not user: raise HTTPException(401,'Invalid email or password')
    return TokenResponse(access_token=issue_token(user,request.app.state.settings),user=UserResponse(id=user.id,name=user.name,role=user.role))

@router.get('/me',response_model=UserResponse,description='Shared: current authenticated identity.')
def me(user:Current): return UserResponse(id=user.id,name=user.name,role=user.role)


@router.post('/register',response_model=UserResponse,status_code=201,description='Public: create a student account assigned to the configured signup supervisor. Supervisor roles cannot be self-registered.')
def register(body:RegisterRequest,request:Request,db:DB):
    identity=body.user_id.lower()
    name=body.name.strip()
    if not name: raise HTTPException(422,'Name is required')
    email=f'{identity}@still.example'
    if db.scalar(select(User).where(or_(User.id==identity,User.email==email))):
        raise HTTPException(409,'This user ID is already in use')
    supervisor=db.get(SupervisorProfile,request.app.state.settings.signup_supervisor_id)
    if not supervisor: raise HTTPException(503,'Account registration is unavailable until a supervisor is configured')
    user=User(id=identity,email=email,name=name,role='STUDENT',password_hash=hash_password(body.password))
    try:
        db.add(user); db.flush()
        db.add(PatientProfile(id=identity,supervisor_id=supervisor.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,'This user ID is already in use') from None
    return UserResponse(id=user.id,name=user.name,role=user.role)
