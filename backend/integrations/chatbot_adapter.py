"""Runs existing chatbot functions in a bounded, isolated worker. No CLI main() calls."""
import json
import subprocess
import sys
from pathlib import Path
from backend.core.config import ROOT

class IntegrationUnavailable(Exception): pass

def process_checkin(input_type, text=None, audio_path=None, patient_id=None, *, mode='mock', timeout=180):
    if mode == 'mock':
        if audio_path:
            raise IntegrationUnavailable('Audio transcription requires integrated mode')
        return {'text':text or '', 'segments':[], 'report':{'report_generated':True}}
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('chatbot_worker.py'))],input=json.dumps({'text':text,'audio_path':audio_path,'root':str(ROOT)}),capture_output=True,text=True,encoding='utf-8',timeout=timeout,cwd=ROOT)
        if result.returncode: raise IntegrationUnavailable()
        output = json.loads(result.stdout)
        if not output.get('text','').strip(): raise IntegrationUnavailable()
        if len(output['text']) > 10000: raise IntegrationUnavailable()
        return output
    except (subprocess.SubprocessError, OSError, ValueError):
        raise IntegrationUnavailable() from None
