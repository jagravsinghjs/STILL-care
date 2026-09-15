import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Mic,
  Square,
  Check,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
} from "lucide-react";
import { Button, Card } from "../../components/ui";
import {
  assistantStatus,
  replyToSession,
  type AssistantTurn,
  type AssistantMode,
} from "../../api/assistant";
import { createReflection } from "../../api/continuity";
import { useApp } from "../../store/useApp";
import { useSpeechInput } from "./useSpeechInput";
export function Assistant() {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<AssistantMode | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"chat" | "review" | "done">("chat");
  const [review, setReview] = useState("");
  const [language, setLanguage] = useState("en-IN");
  const [usedVoice, setUsedVoice] = useState(false);
  const [saved, setSaved] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const controller = useRef(false);
  const speech = useSpeechInput((text) => {
    setDraft((value) => (value + " " + text).trim().slice(0, 4000));
    setUsedVoice(true);
  });
  useEffect(() => {
    let active = true;
    assistantStatus()
      .then((result) => {
        if (active) setMode(result.mode);
      })
      .catch(() => {
        if (active)
          setError(
            "Unable to connect to STILL Assistant. Check that the backend is running and reload this page.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, pending]);
  const total = turns
    .filter((t) => t.role === "user")
    .reduce((sum, t) => sum + t.content.length + 2, 0);
  const limit = turns.length >= 38 || total >= 9500;
  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (controller.current || !draft.trim() || speech.listening || !mode)
      return;
    const content = draft.trim();
    if (total + content.length > 10000) {
      setError("This session is full. Complete it before starting another.");
      return;
    }
    controller.current = true;
    setPending(true);
    setError("");
    const next: AssistantTurn[] = [...turns, { role: "user", content }];
    try {
      const response = await replyToSession(next);
      setTurns([...next, { role: "assistant", content: response.reply }]);
      setMode(response.mode);
      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to send. Please try again.",
      );
    } finally {
      controller.current = false;
      setPending(false);
    }
  }
  async function complete() {
    if (controller.current || saved) return;
    controller.current = true;
    setPending(true);
    setError("");
    try {
      const result = await createReflection(
        review,
        usedVoice ? "Voice" : "Written",
      );
      useApp.getState().addReflection(result);
      setSaved(true);
      setPhase("done");
      try {
        await useApp.getState().refresh();
      } catch {
        useApp.setState({
          error:
            "Session saved. Dashboard refresh is delayed; reload your workspace to update it.",
        });
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Please try again.",
      );
    } finally {
      controller.current = false;
      setPending(false);
    }
  }
  if (phase === "done")
    return (
      <Card className="assistant-complete">
        <span className="success-icon">
          <Check />
        </span>
        <h1>Session complete.</h1>
        <p>
          Your reflection has been saved to your history and processed for
          continuity.
        </p>
        <Link className="button" to="/patient/history">
          View your session <ArrowRight size={17} />
        </Link>
        <button
          className="text-link"
          onClick={() => {
            setTurns([]);
            setDraft("");
            setReview("");
            setSaved(false);
            setUsedVoice(false);
            setPhase("chat");
          }}
        >
          Start another session
        </button>
      </Card>
    );
  if (phase === "review")
    return (
      <div className="narrow">
        <div className="eyebrow">COMPLETE YOUR SESSION</div>
        <h1>Review your reflection.</h1>
        <p className="lead">
          Only your own words are saved as your reflection. You can edit them
          before completing.
        </p>
        <Card>
          <label htmlFor="session-review">Your session reflection</label>
          <textarea
            id="session-review"
            rows={10}
            maxLength={10000}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            disabled={pending}
          />
          <p className="small-text muted">
            Your counsellor receives a continuity summary, not this raw
            conversation.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <Button
              className="secondary"
              disabled={pending}
              onClick={() => setPhase("chat")}
            >
              <ArrowLeft size={16} />
              Back to chat
            </Button>
            <Button disabled={!review.trim() || pending} onClick={complete}>
              {pending ? "Saving session…" : "Complete & save"}
              <Check size={17} />
            </Button>
          </div>
        </Card>
      </div>
    );
  return (
    <div className="assistant-page">
      <header className="assistant-heading">
        <div>
          <div className="eyebrow">YOUR PERSONAL COMPANION</div>
          <h1>
            STILL Assistant<span className="heading-dot">.</span>
          </h1>
          <p>Talk about your day. Make space for what’s on your mind.</p>
        </div>
      </header>
      <div className="assistant-grid">
        <section
          className="assistant-chat"
          aria-label="STILL Assistant session"
        >
          <div className="assistant-chat-header">
            <span className="assistant-icon">
              <MessageCircle size={22} />
            </span>
            <div>
              <h2>STILL Assistant</h2>
              <p>
                {speech.listening
                  ? "Listening to your voice…"
                  : pending
                    ? "Preparing a response…"
                    : "Text or talk — you choose."}
              </p>
            </div>
            <Button
              className="secondary"
              disabled={
                !turns.length || pending || speech.listening || !!draft.trim()
              }
              onClick={() => {
                speech.stop();
                setReview(
                  turns
                    .filter((t) => t.role === "user")
                    .map((t) => t.content)
                    .join("\n\n"),
                );
                setError("");
                setPhase("review");
              }}
            >
              Finish session <Check size={15} />
            </Button>
          </div>
          <div
            className="assistant-log"
            role="log"
            aria-label="Session conversation"
            aria-live="polite"
          >
            <div className="assistant-message">
              <span className="message-speaker">STILL ASSISTANT</span>
              <p>
                Hi, I’m STILL Assistant. What would you like to talk about
                today?
              </p>
            </div>
            {turns.map((turn, i) => (
              <div
                key={i}
                className={`assistant-message ${turn.role === "user" ? "from-user" : ""}`}
              >
                <span className="message-speaker">
                  {turn.role === "user" ? "YOU" : "STILL ASSISTANT"}
                </span>
                <p>{turn.content}</p>
              </div>
            ))}
            {pending && (
              <>
                <div className="assistant-message from-user">
                  <span className="message-speaker">YOU</span>
                  <p>{draft}</p>
                </div>
                <div className="assistant-message typing-indicator">
                  Thinking<span>•••</span>
                </div>
              </>
            )}
            {turns.length === 0 && !pending && (
              <div className="starter-prompts">
                {[
                  "College has felt overwhelming",
                  "I want to talk about my day",
                  "Something good happened today",
                ].map((text) => (
                  <button key={text} onClick={() => setDraft(text)}>
                    <MessageCircle size={14} />
                    {text}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>
          {(error || speech.speechError) && (
            <p role="alert" className="assistant-error">
              {error || speech.speechError}
            </p>
          )}
          {speech.interim && (
            <p className="speech-preview" role="status">
              Hearing: {speech.interim}
            </p>
          )}
          <form className="assistant-composer" onSubmit={send}>
            <label className="sr-only" htmlFor="assistant-draft">
              Your message to STILL Assistant
            </label>
            <textarea
              id="assistant-draft"
              placeholder={
                speech.listening ? "Listening…" : "Type what’s on your mind…"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={Math.min(4000, Math.max(0, 10000 - total))}
              rows={2}
              disabled={pending || limit}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-toolbar">
              <div>
                <button
                  type="button"
                  className={`mic-button ${speech.listening ? "is-listening" : ""}`}
                  aria-label={
                    speech.listening
                      ? "Stop speech recognition"
                      : "Start speech recognition"
                  }
                  aria-pressed={speech.listening}
                  disabled={pending || limit}
                  onClick={() => speech.toggle(language)}
                >
                  {speech.listening ? <Square size={18} /> : <Mic size={19} />}
                </button>
                <select
                  aria-label="Speech language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={speech.listening}
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">हिन्दी</option>
                </select>
                <span className="mic-caption">
                  {speech.listening ? "Tap to stop" : "Speak your message"}
                </span>
              </div>
              <Button
                type="submit"
                disabled={
                  !draft.trim() || pending || speech.listening || !mode || limit
                }
              >
                Send <Send size={17} />
              </Button>
            </div>
          </form>
          <p className="assistant-footnote">
            {limit
              ? "Session limit reached. Finish this session to continue."
              : draft.trim()
                ? "Send or clear your draft before finishing the session."
                : "Speech is transcribed by your browser; availability depends on browser support."}{" "}
            Microphone starts only when you tap it; your browser may use an
            online speech service.
          </p>
        </section>
      </div>
    </div>
  );
}
