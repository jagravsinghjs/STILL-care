import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { Card, Button } from "../../components/ui";
import { useApp } from "../../store/useApp";
export function Profile({ supervisor = false }: { supervisor?: boolean }) {
  const account = useApp((s) => s.identity);
  const supervisorName = useApp((s) => s.supervisorName);
  const logout = useApp((s) => s.logout);
  const navigate = useNavigate();
  return (
    <div className="narrow">
      <span className="eyebrow">
        {supervisor ? "YOUR SUPPORT CONNECTION" : "YOUR PERSONAL SPACE"}
      </span>
      <h1>{supervisor ? "Your counsellor" : "Your profile."}</h1>
      <p className="lead">
        {supervisor
          ? "Counsellor details and messaging."
          : "The essentials, and clarity about your information."}
      </p>
      <Card>
        <div className="supervisor-person">
          <span className="avatar portrait">
            {supervisor
              ? supervisorName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
              : (account?.name ?? "Ananya Sharma")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
          </span>
          <div>
            <h2>
              {supervisor ? supervisorName : (account?.name ?? "Ananya Sharma")}
            </h2>
            <p className="muted">
              {supervisor ? "Assigned supervisor" : "Personal wellbeing"}
            </p>
          </div>
        </div>
        {!supervisor && (
          <dl>
            <dt>User</dt>
            <dd>{account?.name ?? "Ananya Sharma"}</dd>
            <dt>Supervisor</dt>
            <dd>{supervisorName}</dd>
          </dl>
        )}
        <Link to="/patient/messages" className="button">
          Message your supervisor <ArrowRight size={17} />
        </Link>
      </Card>
      {!supervisor && (
        <Button
          className="secondary profile-logout"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut size={17} /> Log out
        </Button>
      )}
    </div>
  );
}
