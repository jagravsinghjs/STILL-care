from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from backend.core.security import DB, Current, authorize_patient
from backend.schemas.checkin import CheckInRequest, SupervisorSessionSummary
from backend.services.checkin_service import submit
from backend.services.report_service import supervisor_summary
from backend.integrations.chatbot_adapter import IntegrationUnavailable

router=APIRouter(prefix='/api/checkins',tags=['Check-ins'])

@router.post('',response_model=SupervisorSessionSummary,status_code=201,description='User-only: submit own written reflection or voice-derived text.')
def checkin(body:CheckInRequest,request:Request,db:DB,user:Current):
    authorize_patient(db,user,body.patient_id,private=True)
    try: return supervisor_summary(submit(db,body.patient_id,body.mode,body.content,request.app.state.settings))
    except IntegrationUnavailable: raise HTTPException(503,{'error':'PIPELINE_UNAVAILABLE','message':'The configured processing pipeline is unavailable.'}) from None
    except Exception: raise HTTPException(503,{'error':'CHECKIN_PROCESSING_FAILED','message':'Unable to process the check-in right now.'}) from None

@router.post('/audio',response_model=SupervisorSessionSummary,status_code=201,description='User-only: upload WAV audio, held in a temporary directory and deleted after processing.')
def audio(request:Request,db:DB,user:Current,patient_id:Annotated[str,Form(max_length=100)],audio:Annotated[UploadFile,File()]):
    authorize_patient(db,user,patient_id,private=True)
    settings=request.app.state.settings
    try:
        if settings.mode=='mock': raise HTTPException(503,{'error':'AUDIO_UNAVAILABLE','message':'Audio transcription requires integrated mode; submit text instead.'})
        if audio.content_type not in ('audio/wav','audio/x-wav','audio/wave'): raise HTTPException(415,'Only WAV audio is supported')
        with TemporaryDirectory(prefix='still-audio-') as directory:
            target=Path(directory)/'input.wav' # Never use the supplied filename or an input path.
            total=0
            with target.open('wb') as out:
                while chunk:=audio.file.read(65536):
                    total+=len(chunk)
                    if total>settings.max_audio_bytes: raise HTTPException(413,'Audio is too large')
                    out.write(chunk)
            with target.open('rb') as source: header=source.read(12)
            if header[:4]!=b'RIFF' or header[8:12]!=b'WAVE': raise HTTPException(415,'Invalid WAV audio')
            return supervisor_summary(submit(db,patient_id,'voice','',settings,str(target)))
    except HTTPException: raise
    except Exception: raise HTTPException(503,{'error':'CHECKIN_PROCESSING_FAILED','message':'Unable to process the check-in right now.'}) from None
    finally: audio.file.close()
