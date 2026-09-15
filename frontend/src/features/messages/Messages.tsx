import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, MessageCircle } from "lucide-react";
import { useApp } from "../../store/useApp";
import { Button, Card } from "../../components/ui";
export function Messages() {
  const role = useApp((s) => s.role)!;
  const users = useApp((s) => s.users);
  const identity = useApp((s) => s.identity);
  const supervisorName = useApp((s) => s.supervisorName);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [params, setParams] = useSearchParams();
  const selected = params.get("user");
  const id =
    role === "user"
      ? identity!.id
      : users.some((s) => s.id === selected)
        ? selected!
        : (users[0]?.id ?? "");
  const allMessages = useApp((s) => s.messages);
  const messages = allMessages.filter((m) => m.userId === id);
  const send = useApp((s) => s.send);
  const [text, setText] = useState("");
  const person =
    role === "user"
      ? supervisorName
      : (users.find((s) => s.id === id)?.name ?? "Select a user");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !id) return;
    setPending(true);
    setError("");
    try {
      await send({
        id: crypto.randomUUID(),
        userId: id,
        sender: role,
        text: text.trim(),
        date: new Date().toISOString(),
      });
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <span className="eyebrow">STAY CONNECTED</span>
      <h1>Messages</h1>
      <p className="lead">
        A conversation with{" "}
        {role === "user" ? "your supervisor" : "the people you support"}.
      </p>
      {role === "supervisor" && (
        <label className="user-select">
          Conversation
          <select
            value={id}
            onChange={(e) => {
              setParams({ user: e.target.value });
              setText("");
            }}
          >
            {users.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Card className="chat">
        <div className="chat-header">
          <span className="avatar">
            {role === "user"
              ? "MI"
              : (users.find((s) => s.id === id)?.initials ?? "")}
          </span>
          <div>
            <h3>{person}</h3>
            <small>Your conversation</small>
          </div>
          <MessageCircle size={22} />
        </div>
        <div className="chat-body" aria-live="polite">
          {messages.length === 0 && (
            <p className="empty">
              Start a supportive conversation with {person.split(" ")[0]}.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`bubble ${m.sender === role ? "own" : ""}`}
            >
              <p>{m.text}</p>
              <small>
                {m.sender === role ? "You" : person} ·{" "}
                {new Date(m.date).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <form onSubmit={submit} className="chat-compose">
          <label className="sr-only" htmlFor="message">
            Your message
          </label>
          <input
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            maxLength={2000}
          />
          <Button
            disabled={!text.trim() || pending || !id}
            type="submit"
            aria-label="Send message"
          >
            <Send size={19} />
          </Button>
        </form>
        <p className="chat-note">Not monitored for urgent support.</p>
      </Card>
    </>
  );
}
