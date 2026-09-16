import { CounsellorProfile } from "../pages/supervisor/Profile";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useApp } from "../store/useApp";
import { Layout } from "../components/layout/Layout";
import { Login } from "../pages/auth/Login";
import { Dashboard } from "../pages/patient/Dashboard";
import { Assistant } from "../features/assistant/Assistant";
import { History } from "../features/history/History";
import { Messages } from "../features/messages/Messages";
import { Profile } from "../pages/patient/Profile";
import { Supervisor } from "../pages/supervisor/Supervisor";
function Guard({ role }: { role: "user" | "supervisor" }) {
  const current = useApp((s) => s.role);
  return current === role ? (
    <Outlet />
  ) : (
    <Navigate
      replace
      to={
        current
          ? current === "user"
            ? "/patient/dashboard"
            : "/supervisor/dashboard"
          : "/login"
      }
    />
  );
}
export function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Guard role="user" />}>
          <Route element={<Layout />}>
            <Route path="/patient/dashboard" element={<Dashboard />} />
            <Route path="/patient/assistant" element={<Assistant />} />
            <Route
              path="/patient/checkin/new"
              element={<Navigate to="/patient/assistant" replace />}
            />
            <Route
              path="/patient/checkin/conversation"
              element={<Navigate to="/patient/assistant" replace />}
            />
            <Route path="/patient/history" element={<History />} />
            <Route path="/patient/messages" element={<Messages />} />
            <Route path="/patient/profile" element={<Profile />} />
            <Route
              path="/patient/supervisor"
              element={<Profile supervisor />}
            />
          </Route>
        </Route>
        <Route element={<Guard role="supervisor" />}>
          <Route element={<Layout />}>
            <Route path="/supervisor/dashboard" element={<Supervisor />} />
            <Route path="/supervisor/profile" element={<CounsellorProfile />} />
            <Route
              path="/supervisor/patients"
              element={<Navigate to="/supervisor/dashboard" replace />}
            />
            <Route
              path="/supervisor/patients/:id"
              element={<Supervisor view="detail" />}
            />
            <Route
              path="/supervisor/alerts"
              element={<Supervisor view="alerts" />}
            />
            <Route path="/supervisor/messages" element={<Messages />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
