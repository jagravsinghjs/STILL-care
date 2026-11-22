"""Supabase is authoritative for identity and approved assignments.

Use the publishable key and the caller's verified access token, never service-role.
Only identity/assignment metadata is mirrored into the existing local database.
"""
import os
from pathlib import Path
import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env.local')
load_dotenv(ROOT / '.env')
URL = os.getenv('VITE_SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
ORIGIN = os.getenv('APP_ORIGIN', 'http://localhost:3000').rstrip('/')


def call(path, body=None, token=None, method=None):
    if not URL or not KEY:
        raise HTTPException(503, 'Configure Supabase in .env.local')
    headers = {'apikey': KEY, 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        response = httpx.request(method or ('POST' if body is not None else 'GET'), URL + path,
                                 headers=headers, json=body, timeout=12)
    except httpx.RequestError:
        raise HTTPException(503, 'Identity service unavailable') from None
    if not response.is_success:
        # Do not return tokens, upstream SQL, or account existence details.
        code = response.json().get('code') if response.headers.get('content-type','').startswith('application/json') else None
        status = 409 if code == '23505' else 403 if code == '42501' else 401 if response.status_code == 401 else 429 if response.status_code == 429 else 422 if response.status_code in (400,422) else 503
        raise HTTPException(status, 'Identity request could not be completed')
    return response.json() if response.content else None


def rpc(name, body, token=None):
    return call('/rest/v1/rpc/' + name, body, token)


def identity(token):
    # Auth /user verifies the JWT with Supabase, including its signature and expiry.
    user = call('/auth/v1/user', token=token)
    if not user.get('email_confirmed_at'):
        raise HTTPException(403, 'Verify your email first')
    snapshot = rpc('identity_snapshot', {}, token)
    if snapshot['profile']['user_id'] != user['id']:
        raise HTTPException(403, 'Identity mismatch')
    return user, snapshot


def mirror(snapshot):
    from db.connection import get_conn
    p = snapshot['profile']
    cid = (snapshot.get('consultant') or {}).get('consultant_id')
    with get_conn() as db:
        for account in snapshot['accounts']:
            db.execute('INSERT INTO consultant_accounts VALUES (?,?,?,1) ON CONFLICT(consultant_id) DO UPDATE SET display_name=excluded.display_name,email=excluded.email,active=1',
                       (account['consultant_id'], account['display_name'], account['email']))
        if cid:
            db.execute('DELETE FROM consultant_assignments WHERE consultant_id=?', (cid,))
            db.execute('DELETE FROM consultant_assignment_requests WHERE consultant_id=?', (cid,))
            db.execute('INSERT INTO consultant_descriptions VALUES (?,?) ON CONFLICT(consultant_id) DO UPDATE SET description=excluded.description', (cid,snapshot['consultant']['professional_description']))
        else:
            db.execute('DELETE FROM consultant_assignments WHERE patient_id=?', (p['user_id'],))
            db.execute('DELETE FROM consultant_assignment_requests WHERE patient_id=?', (p['user_id'],))
            db.execute('INSERT INTO patients(patient_id,display_name,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(patient_id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at', (p['user_id'],p['full_name'],p['created_at'],p['updated_at']))
        for a in snapshot['assignments']:
            db.execute('INSERT INTO consultant_assignments VALUES (?,?,?,?) ON CONFLICT(patient_id) DO UPDATE SET consultant_id=excluded.consultant_id,display_identifier=excluded.display_identifier,accepted_at=excluded.accepted_at', (a['patient_id'],a['consultant_id'],a['display_identifier'],a['approved_at']))
        for r in snapshot['requests']:
            db.execute('INSERT INTO consultant_assignment_requests VALUES (?,?,?,?,?,?,?) ON CONFLICT(request_id) DO UPDATE SET status=excluded.status,responded_at=excluded.responded_at', (r['request_id'],r['patient_id'],r['consultant_id'],r['display_identifier'],r['created_at'],r['status'],r['reviewed_at']))
