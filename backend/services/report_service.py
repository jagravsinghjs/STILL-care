import json
from backend.schemas.checkin import SupervisorSessionSummary, PatientCheckInResponse

SAFE_COPY = {
 'GREEN': ('A check-in has added to the continuity of support.', 'Continue regular, optional check-ins.'),
 'YELLOW': ('A supportive follow-up may be helpful.', 'Offer a conversation and ask what support would help.'),
 'RED': ('Timely supervisor attention is recommended.', 'Arrange a timely personal follow-up through the established support process.')
}

def normalize_report(raw):
    # The existing LLM returns structured JSON with clinician_summary and segments.
    # Neither raw prose (which can quote the user) nor internal scores cross the API.
    if isinstance(raw, str):
        text = raw.strip()
        if text.startswith('```'):
            text = text.split('\n',1)[1].rsplit('```',1)[0]
        raw = json.loads(text)
    if not isinstance(raw, dict): raise ValueError('Invalid report')
    return {'report_generated': True}

def safe_report(state, trend, themes, mode):
    summary, action = SAFE_COPY[state]
    explanation = ('Deterministic fallback scenario for workflow testing.' if mode=='mock' else 'The existing continuity pipeline assigned this attention state; it is not a diagnosis.')
    return dict(attention_state=state,trend=trend,summary=summary,themes=themes,explanation=explanation,recommended_action=action)

def supervisor_summary(checkin):
    o = checkin.observation
    return SupervisorSessionSummary(id=checkin.id,patient_id=checkin.patient_id,mode=checkin.mode,created_at=checkin.created_at,attention_state=o.attention_state,trend=o.trend,summary=o.summary,themes=o.themes,explanation=o.explanation,recommended_action=o.recommended_action,processing_mode=checkin.report.processing_mode)

def patient_report(checkin):
    return PatientCheckInResponse(**supervisor_summary(checkin).model_dump(),raw_reflection=checkin.raw_reflection)
