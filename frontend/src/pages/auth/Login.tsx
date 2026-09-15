import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, ArrowRight } from "lucide-react";
import { useApp } from "../../store/useApp";
import { register } from "../../api/auth";
import { Button } from "../../components/ui";

export function Login() {
  const [role, setRole] = useState<"user" | "supervisor">("user");
  const [signup, setSignup] = useState(false);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useApp((s) => s.login);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (signup && password !== confirm)
        throw new Error("Passwords do not match.");
      if (signup) await register(name, id, password);
      const actual = await login(id, password, role);
      const account = { role: actual };
      navigate(
        account.role === "user"
          ? "/patient/dashboard"
          : "/supervisor/dashboard",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function switchRole(next: "user" | "supervisor") {
    setRole(next);
    setSignup(false);
    setError("");
    setPassword("");
    setId("");
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <div className="brand">
          <Leaf /> STILL-care
        </div>
        <div>
          <h1>
            <span>STILL HERE,</span>
            <span>STILL HEARD,</span>
            <span>STILL SUPPORTED.</span>
          </h1>
        </div>
        <small>Safety, Trust & Intervention for Longitudinal Life-Care</small>
      </div>
      <div className="login-form">
        <h2>
          WELCOME TO <span className="brand-nowrap">STILL-CARE</span>
        </h2>
        <div className="segmented" aria-label="Login role">
          <button
            aria-pressed={role === "user"}
            className={role === "user" ? "selected" : ""}
            onClick={() => switchRole("user")}
          >
            User Login
          </button>
          <button
            aria-pressed={role === "supervisor"}
            className={role === "supervisor" ? "selected" : ""}
            onClick={() => switchRole("supervisor")}
          >
            Counsellor Login
          </button>
        </div>
        <form onSubmit={submit} className="auth-fields">
          {signup && (
            <label>
              Full name
              <input
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label>
            User ID
            <input
              autoComplete="username"
              required
              value={id}
              maxLength={40}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter your user ID"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>
          {signup && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
            <ArrowRight size={18} />
          </Button>
        </form>
        {role === "user" && (
          <button
            className="text-link signup-toggle"
            onClick={() => {
              setSignup(!signup);
              setError("");
              setPassword("");
              setConfirm("");
            }}
          >
            {signup ? "Already have an account? Log in" : "New user? Sign up"}
          </button>
        )}
      </div>
    </div>
  );
}
