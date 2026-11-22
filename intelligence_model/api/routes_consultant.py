"""Owned consultant dashboard. Auth/CSRF identity comes only from trusted middleware."""
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from db.repository import get_unacknowledged_alerts, acknowledge_alert
from .deps import get_db, get_current_patient, get_current_supervisor
from .routes_patient import sessions, session_detail, session_graph

router = APIRouter(prefix='/consultant', tags=['consultant'])


def csrf(request: Request):
    # A header's presence is not CSRF verification. The enclosing cookie-auth
    # middleware must verify it against the authenticated session.
    if getattr(request.state, 'csrf_valid', False) is not True:
        raise HTTPException(403, 'Verified CSRF protection required')


def registered(supervisor=Depends(get_current_supervisor), conn=Depends(get_db)):
    row = conn.execute('SELECT * FROM consultant_accounts WHERE consultant_id=? AND active=1', (supervisor,)).fetchone()
    if row is None:
        raise HTTPException(403, 'An active consultant account is required')
    return dict(row)


def owned(conn, consultant, patient):
    if conn.execute('SELECT 1 FROM consultant_assignments WHERE patient_id=? AND consultant_id=?', (patient, consultant)).fetchone() is None:
        raise HTTPException(404, 'Patient not found')


def create_assignment_request(conn, patient_id, consultant_id, display_identifier):
    """Call inside the auth backend registration transaction AFTER verifying identity.
    Never call this with a client-supplied patient identity/display identifier.
    """
    if not conn.execute('SELECT 1 FROM consultant_accounts WHERE consultant_id=? AND active=1', (consultant_id,)).fetchone():
        raise HTTPException(422, 'Consultant ID is not valid')
    if conn.execute('SELECT 1 FROM consultant_assignments WHERE patient_id=?', (patient_id,)).fetchone():
        raise HTTPException(409, 'Patient already assigned')
    identifier = str(uuid.uuid4())
    try:
        conn.execute('INSERT INTO consultant_assignment_requests (request_id,patient_id,consultant_id,display_identifier,created_at) VALUES (?,?,?,?,?)',
                     (identifier, patient_id, consultant_id, display_identifier, datetime.now(timezone.utc).isoformat()))
    except sqlite3.IntegrityError:
        raise HTTPException(409, 'A pending request already exists')
    return identifier


@router.get('/profile')
def profile(response: Response, account=Depends(registered), conn=Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return {**account, 'patient_count': conn.execute('SELECT COUNT(*) FROM consultant_assignments WHERE consultant_id=?', (account['consultant_id'],)).fetchone()[0]}


@router.get('/patients')
def patients(response: Response, account=Depends(registered), conn=Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    rows = conn.execute('''SELECT a.patient_id AS id, a.display_identifier AS name,
      (SELECT m.mean_score FROM session_summary m JOIN sessions s ON s.session_id=m.session_id AND s.patient_id=m.patient_id
       WHERE m.patient_id=a.patient_id AND s.end_time IS NOT NULL AND m.mean_score BETWEEN 0 AND 100
       ORDER BY s.start_time DESC, s.session_id DESC LIMIT 1) AS mean_score
      FROM consultant_assignments a WHERE a.consultant_id=? ORDER BY a.display_identifier,a.patient_id''', (account['consultant_id'],)).fetchall()
    return {'patients': [dict(row) for row in rows]}


@router.get('/patients/{patient}/sessions')
def history(patient: str, response: Response, account=Depends(registered), conn=Depends(get_db)):
    owned(conn, account['consultant_id'], patient)
    return sessions(response, patient, conn)


@router.get('/patients/{patient}/sessions/{session}')
def detail(patient: str, session: str, response: Response, account=Depends(registered), conn=Depends(get_db)):
    owned(conn, account['consultant_id'], patient)
    data = session_detail(session, response, patient, conn)
    # Consultant surface deliberately omits transcript and patient-only closing text.
    data.pop('messages', None)
    data.pop('conversation_complete', None)
    if data['report']:
        data['report'].pop('message', None)
    explanation = conn.execute('SELECT factors_json FROM risk_explanation WHERE patient_id=? AND session_id=?', (patient, session)).fetchone()
    data['reasons'] = []
    if explanation:
        try:
            factors = json.loads(explanation['factors_json'])
            data['reasons'] = [f['description'] for f in factors if isinstance(f, dict) and isinstance(f.get('description'), str)]
        except (ValueError, TypeError):
            pass
    return data


@router.get('/patients/{patient}/sessions/{session}/graph')
def graph(patient: str, session: str, account=Depends(registered), conn=Depends(get_db)):
    owned(conn, account['consultant_id'], patient)
    return session_graph(session, patient, conn)


@router.get('/notifications')
def notifications(response: Response, account=Depends(registered), conn=Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    cid = account['consultant_id']
    requests = [dict(row) for row in conn.execute('SELECT * FROM consultant_assignment_requests WHERE consultant_id=? ORDER BY created_at DESC', (cid,))]
    assigned = {row[0] for row in conn.execute('SELECT patient_id FROM consultant_assignments WHERE consultant_id=?', (cid,))}
    alerts = [a for a in get_unacknowledged_alerts(conn=conn) if a.patient_id in assigned]
    return {'requests': requests, 'alerts': alerts, 'unread_count': sum(r['status']=='pending' for r in requests) + len(alerts)}


class Decision(BaseModel):
    accept: bool


@router.post('/requests/{identifier}/decision', dependencies=[Depends(csrf)])
def decision(identifier: str, body: Decision, account=Depends(registered), conn=Depends(get_db)):
    row = conn.execute('SELECT * FROM consultant_assignment_requests WHERE request_id=? AND consultant_id=?', (identifier, account['consultant_id'])).fetchone()
    if row is None:
        raise HTTPException(404, 'Request not found')
    now = datetime.now(timezone.utc).isoformat()
    result = conn.execute("UPDATE consultant_assignment_requests SET status=?,responded_at=? WHERE request_id=? AND status='pending'", ('accepted' if body.accept else 'rejected', now, identifier))
    if result.rowcount != 1:
        raise HTTPException(409, 'Request already reviewed')
    if body.accept:
        try:
            conn.execute('INSERT INTO consultant_assignments VALUES (?,?,?,?)', (row['patient_id'], account['consultant_id'], row['display_identifier'], now))
        except sqlite3.IntegrityError:
            raise HTTPException(409, 'Patient already assigned')
    return {'status': 'accepted' if body.accept else 'rejected'}


@router.post('/alerts/{identifier}/acknowledge', dependencies=[Depends(csrf)])
def acknowledge(identifier: str, account=Depends(registered), conn=Depends(get_db)):
    row = conn.execute('SELECT patient_id FROM alerts WHERE alert_id=?', (identifier,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Alert not found')
    owned(conn, account['consultant_id'], row['patient_id'])
    acknowledge_alert(identifier, account['consultant_id'], datetime.now(timezone.utc), conn=conn)
    return {'status': 'acknowledged'}
