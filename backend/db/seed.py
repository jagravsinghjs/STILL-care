"""Idempotent fictional accounts. Passwords supplied by caller, never source-controlled."""
from datetime import timedelta
import json
import secrets
from backend.core.config import Settings, ROOT
from backend.core.security import hash_password
from backend.db.database import Base, make_engine
from backend.db.models import User, PatientProfile, SupervisorProfile, Alert, now
from backend.services.checkin_service import submit
from sqlalchemy.orm import Session

IDENTITIES=[('meera','Dr. Meera Iyer','SUPERVISOR'),('ananya','Ananya Sharma','STUDENT'),('rohan','Rohan Menon','STUDENT'),('isha','Isha Patel','STUDENT')]

# Fixed demo credentials for the two named presentation accounts.
# These are fictional hackathon demo values – not production secrets.
DEMO_PASSWORD='StillDemo!2026'
FIXED_DEMO_ACCOUNTS={'ananya':DEMO_PASSWORD,'meera':DEMO_PASSWORD}

def seed(db,passwords,settings,include_checkins=True):
    fresh=[]
    for identity,name,role in IDENTITIES:
        existing=db.get(User,identity)
        if not existing:
            db.add(User(id=identity,email=f'{identity}@still.example',name=name,role=role,password_hash=hash_password(passwords[identity])))
            fresh.append(identity)
        elif identity in FIXED_DEMO_ACCOUNTS:
            # Update the password hash so the documented demo credentials always work
            # even when the account was created with a previously generated random password.
            existing.password_hash=hash_password(FIXED_DEMO_ACCOUNTS[identity])
    db.flush()
    if not db.get(SupervisorProfile,'meera'): db.add(SupervisorProfile(id='meera'))
    db.flush()
    for identity,_,role in IDENTITIES:
        if role=='STUDENT' and not db.get(PatientProfile,identity): db.add(PatientProfile(id=identity,supervisor_id='meera'))
    db.commit()
    # Seed content is synthetic, not real user text. Explicit tags select mock test scenarios.
    examples={'ananya':['I made time to rest after a busy day.','[mock:yellow] Daily responsibilities have been demanding.'], 'rohan':['[mock:yellow] Work and family responsibilities have continued.','[mock:red] I would like a timely conversation about support.'], 'isha':['A steady routine and time with friends helped this week.']}
    if include_checkins:
        for identity in fresh:
            for index,content in enumerate(examples.get(identity,[])):
                item=submit(db,identity,'written',content,settings)
                # Fictional seed history spans distinct days, not the seeding instant.
                timestamp=now()-timedelta(days=7-index*5)
                item.created_at=timestamp
                item.observation.created_at=timestamp
                for alert in db.query(Alert).filter(Alert.checkin_id==item.id): alert.created_at=timestamp
                db.commit()
    return fresh

if __name__=='__main__':
    settings=Settings()
    if settings.mode!='mock': raise SystemExit('Seed examples require BACKEND_MODE=mock.')
    engine=make_engine(settings.database_url); Base.metadata.create_all(engine)
    credentials_path=ROOT/'backend/data/demo-credentials.json'
    credentials_path.parent.mkdir(parents=True,exist_ok=True)
    saved=json.loads(credentials_path.read_text()) if credentials_path.exists() else {}
    # ananya and meera always use the fixed demo password; rohan and isha get random passwords.
    passwords={identity:(FIXED_DEMO_ACCOUNTS[identity] if identity in FIXED_DEMO_ACCOUNTS else secrets.token_urlsafe(18)) for identity,_,_ in IDENTITIES}
    with Session(engine) as db: fresh=seed(db,passwords,settings)
    for identity in fresh: saved[identity]={'email':f'{identity}@still.example','password':passwords[identity]}
    # Always write the fixed-credential accounts so the credentials file stays consistent.
    for identity in FIXED_DEMO_ACCOUNTS:
        saved[identity]={'email':f'{identity}@still.example','password':FIXED_DEMO_ACCOUNTS[identity]}
    credentials_path.write_text(json.dumps(saved,indent=2),encoding='utf-8')
    print('Seed complete. Local credentials: backend/data/demo-credentials.json (git-ignored).')
