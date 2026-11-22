"""Run from repo root: .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000

Single worker: the local model and session locks are intentionally process-local.
Only ownership-scoped routers are exposed; legacy supervisor-wide APIs are not mounted.
"""
import hashlib
import secrets
import sys
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from starlette.concurrency import run_in_threadpool
from . import cloud

sys.path.insert(0, str(cloud.ROOT / 'intelligence_model'))
from db.connection import init_schema
from api.routes_patient import router as patient_router
from api.routes_consultant import router as consultant_router
from api.routes_profiles import router as profiles_router

@asynccontextmanager
async def lifespan(app):
    init_schema()
    yield

app = FastAPI(title='STILL-care local gateway', lifespan=lifespan, docs_url=None, redoc_url=None)
SECURE = cloud.ORIGIN.startswith('https://')
refresh_lock = threading.Lock()
refresh_cache = {}
attempts = defaultdict(deque)


def cookie(response, name, value, age):
    response.set_cookie(name, value, max_age=age, httponly=True, secure=SECURE, samesite='lax', path='/api')


def tokens(response, data):
    cookie(response, 'still_access', data['access_token'], 86400 * 30)
    cookie(response, 'still_refresh', data['refresh_token'], 86400 * 30)


def clear(response):
    for key in ('still_access', 'still_refresh', 'still_csrf'):
        response.delete_cookie(key, path='/api', httponly=True, secure=SECURE, samesite='lax')


def resolve(request):
    token = request.cookies.get('still_access')
    if not token:
        return None
    try:
        user, snapshot = cloud.identity(token)
        refreshed = None
    except HTTPException as error:
        refresh = request.cookies.get('still_refresh')
        if error.status_code != 401 or not refresh:
            raise
        with refresh_lock:
            now = time.monotonic()
            for old in list(refresh_cache):
                if refresh_cache[old][0] < now - 20:
                    del refresh_cache[old]
            key = hashlib.sha256(refresh.encode()).hexdigest()
            refreshed = refresh_cache.get(key, (None,None))[1]
            if refreshed is None:
                refreshed = cloud.call('/auth/v1/token?grant_type=refresh_token', {'refresh_token': refresh})
                refresh_cache[key] = (now, refreshed)
        token = refreshed['access_token']
        user, snapshot = cloud.identity(token)
    cloud.mirror(snapshot)
    request.state.cloud_token = token
    request.state.snapshot = snapshot
    request.state.auth_user = {'id': user['id'], 'email': user['email'], 'role': 'supervisor' if snapshot['profile']['role']=='consultant' else 'patient'}
    if request.state.auth_user['role'] == 'supervisor':
        request.state.supervisor_id = snapshot['consultant']['consultant_id']
    else:
        request.state.patient_id = user['id']
    return refreshed


@app.middleware('http')
async def security(request, call_next):
    if not request.url.path.startswith('/api/'):
        return await call_next(request)
    try:
        if request.method not in ('GET','HEAD','OPTIONS'):
            if request.headers.get('origin') != cloud.ORIGIN:
                raise HTTPException(403, 'Origin not allowed')
            sent, expected = request.headers.get('x-csrf-token',''), request.cookies.get('still_csrf','')
            if not sent or not expected or not secrets.compare_digest(sent, expected):
                raise HTTPException(403, 'Refresh the page before trying again')
            request.state.csrf_valid = True
        public = request.url.path in {'/api/auth/session','/api/auth/login','/api/auth/register','/api/auth/forgot-password','/api/auth/exchange','/api/auth/logout'}
        refreshed = None
        if request.url.path == '/api/auth/session' or not public:
            try:
                refreshed = await run_in_threadpool(resolve, request)
            except HTTPException as error:
                if request.url.path != '/api/auth/session' or error.status_code not in (401,403):
                    raise
            if not public and not getattr(request.state,'auth_user',None):
                raise HTTPException(401, 'Sign in required')
        response = await call_next(request)
        if refreshed:
            tokens(response, refreshed)
    except HTTPException as error:
        response = JSONResponse({'detail': error.detail}, status_code=error.status_code)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


def limit(request):
    now = time.monotonic()
    key = request.client.host if request.client else 'local'
    # One local process, bounded buckets. Do not trust X-Forwarded-For from browsers.
    for old in list(attempts):
        if not attempts[old] or attempts[old][-1] < now - 600:
            del attempts[old]
    values = attempts[key]
    while values and values[0] < now - 600:
        values.popleft()
    if len(values)>=20:
        raise HTTPException(429,'Please wait before trying again')
    values.append(now)


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid')
class Login(Input):
    email: str = Field(min_length=3,max_length=254)
    password: str = Field(min_length=1,max_length=256)
    role: Literal['patient','supervisor']
class Registration(Input):
    email: str = Field(min_length=3,max_length=254)
    password: str = Field(min_length=8,max_length=256)
    consultantId: str = Field(min_length=1,max_length=80)
class Recovery(Input):
    email: str = Field(min_length=3,max_length=254)
    role: Literal['patient','supervisor']
class Exchange(Input):
    access_token: str = Field(min_length=1,max_length=10000)
    refresh_token: str = Field(min_length=1,max_length=2000)
class Password(Input):
    password: str = Field(min_length=8,max_length=256)


def signed_in(data, response, role=None):
    user, snapshot = cloud.identity(data['access_token'])
    actual = 'supervisor' if snapshot['profile']['role']=='consultant' else 'patient'
    if role and actual != role:
        raise HTTPException(403,'This account does not have the selected role')
    cloud.mirror(snapshot)
    tokens(response,data)
    return {'user': {'id':user['id'],'email':user['email'],'role':actual}}


@app.get('/api/auth/session')
def session(request: Request, response: Response):
    csrf = request.cookies.get('still_csrf') or secrets.token_urlsafe(32)
    cookie(response,'still_csrf',csrf,86400)
    return {'user': getattr(request.state,'auth_user',None), 'csrfToken':csrf}

@app.post('/api/auth/login')
def login(body: Login, request: Request, response: Response):
    limit(request)
    data = cloud.call('/auth/v1/token?grant_type=password', {'email':body.email,'password':body.password})
    return signed_in(data,response,body.role)

@app.post('/api/auth/register')
def register(body: Registration, request: Request):
    limit(request)
    if not cloud.rpc('valid_consultant',{'code':body.consultantId}):
        raise HTTPException(422,'Consultant ID is not valid')
    cloud.call('/auth/v1/signup', {'email':body.email,'password':body.password,'data':{'consultant_id':body.consultantId}})
    return {'status':'created'}

@app.post('/api/auth/forgot-password')
def forgot(body: Recovery, request: Request):
    limit(request)
    cloud.call('/auth/v1/recover', {'email':body.email})
    return {'status':'accepted'}

@app.post('/api/auth/exchange')
def exchange(body: Exchange, request: Request, response: Response):
    limit(request)
    return signed_in(body.model_dump(),response)

@app.post('/api/auth/password')
def password(body: Password, request: Request, response: Response):
    cloud.call('/auth/v1/user', {'password':body.password}, request.state.cloud_token, method='PUT')
    cloud.call('/auth/v1/logout?scope=global', {}, request.state.cloud_token)
    clear(response)
    return {'status':'updated'}

@app.post('/api/auth/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get('still_access')
    if token:
        try:
            cloud.call('/auth/v1/logout?scope=global', {}, token)
        except HTTPException as error:
            if error.status_code != 401:
                raise
    clear(response)
    return {'status':'signed_out'}

@app.get('/api/health')
def health():
    return {'status':'running','identity_configured':bool(cloud.URL and cloud.KEY)}

@app.get('/api/patient/contact')
def contact(request: Request):
    if not getattr(request.state,'patient_id',None):
        raise HTTPException(403,'Patient account required')
    snapshot = request.state.snapshot
    assignment = next(iter(snapshot['assignments']),None)
    account = next((a for a in snapshot['accounts'] if assignment and a['consultant_id']==assignment['consultant_id']),None)
    return {'consultant':account,'pending':any(r['status']=='pending' for r in snapshot['requests'])}

@app.get('/api/notifications')
def notices(request: Request):
    return cloud.call('/rest/v1/notifications?select=*&order=created_at.desc',token=request.state.cloud_token)

@app.post('/api/notifications/{identifier}/read')
def read_notice(identifier: str, request: Request):
    cloud.rpc('read_notification',{'identifier':identifier},request.state.cloud_token)
    return {'status':'read'}

app.include_router(patient_router, prefix='/api/intelligence')
app.include_router(consultant_router, prefix='/api/intelligence')
app.include_router(profiles_router, prefix='/api/intelligence')
from .voice import router as voice_router
app.include_router(voice_router, prefix='/api')
