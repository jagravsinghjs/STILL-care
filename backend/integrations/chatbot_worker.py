"""Private process boundary for existing model functions; stdout is protocol-only."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys

def load(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def run(payload):
    root=Path(payload['root'])/'chatbot'
    llm=load(root/'04_chat_llm/chat_llm.py','still_chat_llm')
    # Never import 01_speech_to_text/whisper.py: it runs CUDA and fixed-file I/O on import.
    if payload.get('audio_path'):
        from faster_whisper import WhisperModel
        acoustic=load(root/'02_acoustic_metrics/acoustic_metric.py','still_acoustic')
        emotion=load(root/'03_adding_emotions/emotion.py','still_speech_emotion')
        wav=payload['audio_path']
        segments,_=WhisperModel('medium',device='cpu',compute_type='int8').transcribe(wav,beam_size=5)
        segments=[{'start':s.start,'end':s.end,'text':s.text.strip()} for s in segments]
        # WAV-only transport avoids the existing FFmpeg helper's open-tempfile issue on Windows.
        import soundfile as sf
        import librosa
        samples,sr=sf.read(wav,dtype='float32',always_2d=True)
        y=samples.mean(axis=1)
        if sr!=16000: y=librosa.resample(y,orig_sr=sr,target_sr=16000)
        sr=16000
        ey,esr=y,sr
        extractor,model=emotion.load_model()
        for s in segments:
            s['acoustic_features']=acoustic.extract_segment_features(y,sr,s['start'],s['end'])
            s['arousal_label']=acoustic.classify_arousal(s['acoustic_features'])
            s['speech_emotion']=emotion.predict_emotion(extractor,model,ey[int(s['start']*esr):int(s['end']*esr)],esr)
    else:
        # Reuse the text-emotion model selected by 05_voice_chat without its live recording loop.
        from transformers import pipeline
        classifier=pipeline('text-classification',model='j-hartmann/emotion-english-distilroberta-base',top_k=None,device=-1)
        mapping={'anger':'angry','fear':'fearful','joy':'happy','sadness':'sad','surprise':'surprised','disgust':'disgust','neutral':'neutral'}
        probs={mapping[item['label']]:item['score'] for item in classifier(payload['text'],truncation=True)[0]}
        # Missing audio cues are explicitly represented as zero measurements and unknown arousal.
        # The inspected bridge maps unknown to MODERATE. This limitation is documented.
        segments=[{'start':0,'end':0,'text':payload['text'],'acoustic_features':{'pitch_mean_hz':0,'pitch_std_hz':0,'energy_mean':0,'energy_std':0,'zero_crossing_rate':0,'pause_ratio':0},'arousal_label':'unknown','speech_emotion':probs}]
    report=llm.call_ollama(segments)
    return {'text':' '.join(s['text'] for s in segments),'segments':segments,'report':report}

if __name__=='__main__':
    try:
        payload=json.load(sys.stdin)
        # Existing modules may print model output. Discard rather than log it.
        with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
            result=run(payload)
        print(json.dumps(result,ensure_ascii=False))
    except Exception:
        sys.exit(1)
