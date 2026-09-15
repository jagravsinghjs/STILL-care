import { useEffect } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  History,
  MessageCircle,
  UserRound,
  Leaf,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import { useApp } from "../../store/useApp";
export function Layout() {
  const role = useApp((s) => s.role);
  const account = useApp((s) => s.identity);
  const error = useApp((s) => s.error);
  useEffect(() => {
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await useApp.getState().refresh();
      } catch (e) {
        useApp.setState({
          error: e instanceof Error ? e.message : "Unable to refresh.",
        });
      } finally {
        busy = false;
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  const supervisor = role === "supervisor";
  const links = supervisor
    ? ([
        ["/supervisor/dashboard", "Dashboard", LayoutDashboard],
        ["/supervisor/profile", "Profile", UserRound],
        ["/supervisor/alerts", "Alerts", Bell],
        ["/supervisor/messages", "Messages", MessageCircle],
      ] as const)
    : ([
        ["/patient/dashboard", "Dashboard", LayoutDashboard],
        ["/patient/assistant", "STILL Assistant", MessageCircle],
        ["/patient/history", "History", History],
        ["/patient/messages", "Messages", MessageCircle],
        ["/patient/profile", "Profile", UserRound],
      ] as const);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          to={supervisor ? "/supervisor/dashboard" : "/patient/dashboard"}
          className="brand"
        >
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          STILL<span className="brand-care">-care</span>
        </Link>
        <div className="workspace-label">
          {supervisor ? "YOUR SUPPORT SPACE" : "YOUR PERSONAL SPACE"}
        </div>
        <nav aria-label="Main navigation">
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
              {label === "Messages" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className="account"
            to={supervisor ? "/supervisor/profile" : "/patient/profile"}
          >
            <span className="avatar">
              {supervisor
                ? "MI"
                : (account?.name ?? "Ananya Sharma")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
            </span>
            <span>
              <strong>
                {supervisor
                  ? "Dr. Meera Iyer"
                  : (account?.name ?? "Ananya Sharma")}
              </strong>
              <small>{supervisor ? "Counsellor" : "User"}</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>STILL HERE, STILL HEARD, STILL SUPPORTED</span>
          <div>
            <Link
              aria-label="Open messages"
              className="icon-button"
              to={supervisor ? "/supervisor/messages" : "/patient/messages"}
            >
              <Bell size={19} />
            </Link>
            <span className="avatar small">
              {supervisor
                ? "MI"
                : (account?.name ?? "Ananya Sharma")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
            </span>
          </div>
        </header>
        <main id="main-content">
          {error && <p role="alert">{error}</p>}
          <Outlet />
        </main>
        <footer>STILL-care </footer>
      </div>
    </div>
  );
}
