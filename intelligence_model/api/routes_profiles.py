"""Private profile persistence using the same identity and SQLite boundaries."""
import io
import warnings
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, ConfigDict
from PIL import Image, UnidentifiedImageError
from .deps import get_db, get_current_patient, get_current_supervisor
from .routes_consultant import csrf, registered

router = APIRouter(prefix='/profiles', tags=['profiles'])
Role = Literal['patient', 'consultant']


def owner(role: Role, request: Request, conn=Depends(get_db)):
    if role == 'patient':
        return get_current_patient(request)
    return registered(get_current_supervisor(request), conn)['consultant_id']


class Update(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(max_length=120)
    text: str = Field(max_length=2000)


@router.get('/{role}')
def read(role: Role, response: Response, identity=Depends(owner), conn=Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    photo = bool(conn.execute('SELECT 1 FROM profile_photos WHERE role=? AND owner_id=?', (role, identity)).fetchone())
    if role == 'consultant':
        account = registered(identity, conn)
        description = conn.execute('SELECT description FROM consultant_descriptions WHERE consultant_id=?', (identity,)).fetchone()
        return {'name': account['display_name'], 'email': account['email'], 'consultant_id': identity,
                'text': description[0] if description else '', 'photo_available': photo,
                'patient_count': conn.execute('SELECT COUNT(*) FROM consultant_assignments WHERE consultant_id=?', (identity,)).fetchone()[0]}
    patient = conn.execute('SELECT display_name FROM patients WHERE patient_id=?', (identity,)).fetchone()
    narrative = conn.execute('SELECT narrative FROM patient_personalization WHERE patient_id=?', (identity,)).fetchone()
    consultant = conn.execute('''SELECT c.consultant_id,c.display_name FROM consultant_assignments a
       JOIN consultant_accounts c ON c.consultant_id=a.consultant_id WHERE a.patient_id=?''', (identity,)).fetchone()
    pending = bool(conn.execute("SELECT 1 FROM consultant_assignment_requests WHERE patient_id=? AND status='pending'", (identity,)).fetchone())
    return {'name': patient[0] or '' if patient else '', 'text': narrative[0] if narrative else '',
            'photo_available': photo, 'supervisor': dict(consultant) if consultant else None,
            'assignment_status': 'accepted' if consultant else 'pending' if pending else 'none'}


@router.post('/{role}', dependencies=[Depends(csrf)])
def save(role: Role, body: Update, response: Response, identity=Depends(owner), conn=Depends(get_db)):
    if role == 'consultant':
        if not body.name.strip() or len(body.text) > 1000:
            raise HTTPException(422, 'Name required; description maximum 1000 characters')
        conn.execute('UPDATE consultant_accounts SET display_name=? WHERE consultant_id=?', (body.name.strip(), identity))
        conn.execute('INSERT INTO consultant_descriptions VALUES (?,?) ON CONFLICT(consultant_id) DO UPDATE SET description=excluded.description', (identity, body.text))
    else:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute('''INSERT INTO patients (patient_id,display_name,created_at,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(patient_id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at''', (identity, body.name.strip(), now, now))
        conn.execute('''INSERT INTO patient_personalization VALUES (?,?,?) ON CONFLICT(patient_id)
          DO UPDATE SET narrative=excluded.narrative,updated_at=excluded.updated_at''', (identity, body.text, now))
    return read(role, response, identity, conn)


async def image_body(request: Request):
    if request.headers.get('content-type', '').split(';')[0] not in ('image/jpeg','image/png','image/webp'):
        raise HTTPException(415, 'Use a JPEG, PNG or WebP image')
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > 2 * 1024 * 1024:
            raise HTTPException(413, 'Image must be no larger than 2 MB')
    return bytes(content)


@router.post('/{role}/photo', dependencies=[Depends(csrf)])
def upload(role: Role, content: bytes = Depends(image_body), identity=Depends(owner), conn=Depends(get_db)):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(content)) as source:
                if source.format not in ('JPEG','PNG','WEBP') or getattr(source,'n_frames',1) != 1 or source.width * source.height > 8_000_000:
                    raise ValueError()
                source.load()
                # Re-encoding removes metadata and embedded non-image payloads.
                from PIL import ImageOps
                clean = ImageOps.exif_transpose(source).convert('RGB')
                clean.thumbnail((1024, 1024))
                output = io.BytesIO()
                clean.save(output, format='PNG')
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'Invalid image; use a static image up to 8 megapixels')
    conn.execute('INSERT INTO profile_photos VALUES (?,?,?) ON CONFLICT(role,owner_id) DO UPDATE SET image_png=excluded.image_png', (role, identity, output.getvalue()))
    return {'status':'saved'}


@router.get('/{role}/photo')
def photo(role: Role, identity=Depends(owner), conn=Depends(get_db)):
    row = conn.execute('SELECT image_png FROM profile_photos WHERE role=? AND owner_id=?', (role, identity)).fetchone()
    if row is None:
        raise HTTPException(404, 'No photo saved')
    return Response(bytes(row[0]), media_type='image/png', headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
