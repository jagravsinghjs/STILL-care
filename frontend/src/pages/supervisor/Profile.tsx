import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Card, Button } from "../../components/ui";
import { useApp } from "../../store/useApp";
export function CounsellorProfile() {
  const identity = useApp((s) => s.identity);
  const logout = useApp((s) => s.logout);
  const navigate = useNavigate();
  return (
    <div className="narrow">
      <span className="eyebrow">COUNSELLOR ACCOUNT</span>
      <h1>Your profile</h1>
      <Card>
        <div className="supervisor-person">
          <span className="avatar portrait">
            {identity?.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <h2>{identity?.name}</h2>
            <p className="muted">Counsellor</p>
          </div>
        </div>
        <dl>
          <dt>User ID</dt>
          <dd>{identity?.id}</dd>
          <dt>Role</dt>
          <dd>Supervisor</dd>
          <dt>Workspace</dt>
          <dd>STILL-care</dd>
        </dl>
        <p className="muted">
          Review continuity updates, follow up on alerts, and message users
          through your dashboard.
        </p>
      </Card>
      <Button
        className="secondary profile-logout"
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        <LogOut size={17} /> Log out
      </Button>
    </div>
  );
}
