import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Mic, Send, Square } from "lucide-react";
import { Button, Card } from "../../components/ui";
import { useApp } from "../../store/useApp";
import { endSession, sendAudioTurn, sendTextTurn, startSession, type AssistantTurn } from "../../api/assistant";

export function Assistant() {
  const status = useApp((s) => s.status);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  async function ensureSession() {
    if (sessionId) return sessionId;
    const result = await startSession();
    setSessionId(result.session_id);
    return result.session_id;
  }

  async function sendText(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true); setError("");
    try {
      const result = await sendTextTurn(await ensureSession(), text);
      setTurns((items) => [...items, { role: "user", content: result.transcript }, { role: "assistant", content: result.reply }]);
      setDraft("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send your message."); }
    finally { setBusy(false); }
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const instance = new MediaRecorder(stream);
      chunks.current = [];
      instance.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      instance.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: instance.mimeType || "audio/webm" });
        setRecording(false); setBusy(true);
        try {
          const result = await sendAudioTurn(await ensureSession(), blob);
          setTurns((items) => [...items, { role: "user", content: result.transcript }, { role: "assistant", content: result.reply }]);
        } catch (e) { setError(e instanceof Error ? e.message : "Unable to process the recording."); }
        finally { setBusy(false); chunks.current = []; }
      };
      recorder.current = instance; instance.start(); setRecording(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Microphone access is unavailable."); }
  }

  async function finish() {
    if (!sessionId || !turns.length || busy) return;
    setBusy(true); setError("");
    try { await endSession(sessionId); setSessionId(null); setTurns([]); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to finish the session."); }
    finally { setBusy(false); }
  }

  return <div className="assistant-page">
    <header className="assistant-heading"><div><div className="eyebrow">YOUR PERSONAL COMPANION</div><h1>STILL Assistant<span className="heading-dot">.</span></h1><p>Type or record a message. Audio is transcribed securely on the STILL server.</p></div></header>
    <Card className="assistant-chat">
      <div className="assistant-chat-header"><div><h2><span className={`status-dot ${status}`} aria-label={`Risk status: ${status}`} />STILL Assistant</h2><p>{recording ? "Recording…" : busy ? "Preparing a response…" : "You can type or talk."}</p></div><Button className="secondary" disabled={!turns.length || busy || recording} onClick={finish}>Finish session <Check size={15} /></Button></div>
      <div className="assistant-log" role="log" aria-live="polite">
        {!turns.length && <div className="assistant-message"><span className="message-speaker">STILL ASSISTANT</span><p>Hi, I’m STILL Assistant. What would you like to talk about today?</p></div>}
        {turns.map((turn, index) => <div key={index} className={`assistant-message ${turn.role === "user" ? "from-user" : ""}`}><span className="message-speaker">{turn.role === "user" ? "YOU" : "STILL ASSISTANT"}</span><p>{turn.content}</p></div>)}
      </div>
      {error && <p className="assistant-error" role="alert">{error}</p>}
      <form className="assistant-composer" onSubmit={sendText}>
        <textarea aria-label="Your message to STILL Assistant" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy || recording} placeholder="Type what’s on your mind…" rows={2} />
        <Button type="submit" disabled={!draft.trim() || busy || recording} aria-label="Send typed message"><Send size={18} /></Button>
        <Button type="button" className="secondary" disabled={busy} aria-label={recording ? "Stop recording" : "Record audio"} onClick={() => recording ? recorder.current?.stop() : startRecording()}>{recording ? <Square size={18} /> : <Mic size={18} />}</Button>
      </form>
      <p className="chat-note">Audio is processed for this session and not retained after processing.</p>
    </Card>
    <Link className="text-link" to="/patient/history">View previous sessions</Link>
  </div>;
}
