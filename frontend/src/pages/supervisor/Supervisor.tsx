import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, Search } from "lucide-react";
import { Card, Badge, Button, EmptyState } from "../../components/ui";
import { useApp } from "../../store/useApp";
import { dateLabel } from "../../utils/date";
export function Supervisor({
  view = "dashboard",
}: {
  view?: "dashboard" | "users" | "alerts" | "detail";
}) {
  const { id } = useParams();
  const [query, setQuery] = useState("");
  const followed = useApp((s) => s.followed);
  const follow = useApp((s) => s.follow);
  const users = useApp((s) => s.users);
  const summaries = useApp((s) => s.summaries);
  const alerts = useApp((s) => s.alerts);
  const identity = useApp((s) => s.identity);
  const continuity = summaries[id ?? ""] ?? [];
  const person = users.find((s) => s.id === id);
  let list = users.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  if (view === "dashboard")
    list = [...list].sort(
      (a, b) =>
        Number(b.status === "Increasing concern") -
        Number(a.status === "Increasing concern"),
    );
  if (view === "alerts")
    list = list.filter((s) =>
      alerts.some((a) => a.patient_id === s.id && a.status === "open"),
    );
  if (view === "detail")
    return person ? (
      <>
        <Link className="text-link" to="/supervisor/dashboard">
          ← All users
        </Link>
        <h1>{person.name}</h1>
        <p className="lead">{person.context}</p>
        <Card>
          <Badge>{person.status}</Badge>
          <h2 className="mt-5">{person.trend}</h2>
          <p>{person.summary}</p>
          <Link
            className="button"
            to={`/supervisor/messages?user=${person.id}`}
          >
            Start a conversation <ArrowRight size={17} />
          </Link>
        </Card>
        <div className="section-heading">
          <h2>Continuity timeline</h2>
          <span>High-level observations only</span>
        </div>
        <Card>
          {continuity.length ? (
            continuity.map((c) => (
              <article className="history-item" key={c.id}>
                <div>
                  <small>
                    {dateLabel(c.date)} · {c.mode}
                  </small>
                  <h3>{c.observation}</h3>
                </div>
              </article>
            ))
          ) : (
            <p>{person.summary}</p>
          )}
        </Card>
        <p className="privacy">
          Raw reflections and transcripts are not included. States and trends
          are not clinical assessments.
        </p>
      </>
    ) : (
      <EmptyState>
        User not found. <Link to="/supervisor/dashboard">Back to users</Link>
      </EmptyState>
    );
  return (
    <>
      <span className="eyebrow">CONTINUITY OF SUPPORT</span>
      <h1>
        {view === "dashboard"
          ? `Good morning, ${identity?.name ?? ""}.`
          : view === "alerts"
            ? "Alerts"
            : "Your users."}
      </h1>
      <p className="lead">
        {view === "dashboard"
          ? "Review user updates and follow-ups."
          : view === "alerts"
            ? "Follow-ups that could benefit from your attention."
            : "A clear view of each user’s ongoing journey."}
      </p>
      <div className="notice">
        Attention states and trends support human review; they are not
        diagnoses.
      </div>
      <div className="section-heading">
        <h2>
          {view === "alerts"
            ? "Open follow-ups"
            : view === "dashboard"
              ? "User updates"
              : "User directory"}
        </h2>
        {view !== "alerts" && (
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a user"
            />
          </label>
        )}
      </div>
      <div className="user-list">
        {list.map((s) => (
          <Card key={s.id}>
            <div className="user-row">
              <span className="avatar">{s.initials}</span>
              <div className="grow">
                <Link className="user-name" to={`/supervisor/patients/${s.id}`}>
                  {s.name}
                </Link>
                <small className="block muted">{s.context}</small>
              </div>
              <Badge>{s.status}</Badge>
            </div>
            <div className="user-summary">
              <div>
                <span className="eyebrow">{s.trend}</span>
                <p>{s.summary}</p>
              </div>
              <div className="user-actions">
                <Link className="text-link" to={`/supervisor/patients/${s.id}`}>
                  View continuity <ArrowRight size={16} />
                </Link>
                <Link
                  className="button secondary"
                  to={`/supervisor/messages?user=${s.id}`}
                >
                  Send a message
                </Link>
                {s.status !== "Stable" && (
                  <Button
                    className="quiet"
                    disabled={followed.includes(s.id)}
                    onClick={() => follow(s.id)}
                  >
                    {followed.includes(s.id) ? (
                      <>
                        <Check size={16} /> Reviewed
                      </>
                    ) : (
                      "Mark reviewed"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && (
        <EmptyState>
          {view === "alerts"
            ? "You’re up to date. All follow-ups have been reviewed."
            : "No users match your search."}
        </EmptyState>
      )}
    </>
  );
}
