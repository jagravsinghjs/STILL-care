from types import SimpleNamespace
from backend.core.config import ROOT
from backend.integrations import chatbot_worker


def test_worker_uses_downloaded_root_stage(monkeypatch):
    import sys
    paths = []
    def load(path, name):
        assert path.is_file()
        paths.append(path)
        return SimpleNamespace(call_ollama=lambda segments: {'report_generated': True})
    monkeypatch.setattr(chatbot_worker, 'load', load)
    classifier = lambda *args, **kwargs: [[{'label': 'neutral', 'score': 1.0}]]
    monkeypatch.setitem(sys.modules, 'transformers', SimpleNamespace(pipeline=lambda *args, **kwargs: classifier))
    result = chatbot_worker.run({'root': str(ROOT), 'text': 'Synthetic integration check.'})
    assert paths == [ROOT / '04_chat_llm/chat_llm.py']
    assert result['text'] == 'Synthetic integration check.'
    assert result['segments'][0]['speech_emotion'] == {'neutral': 1.0}
