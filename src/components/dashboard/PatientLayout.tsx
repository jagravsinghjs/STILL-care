import { useEffect } from 'react';
import { Headset, UserRound } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { destinationFor } from '../../auth/service';
import '../../styles/dashboard.css';

export default function PatientLayout() {
  const { user, restoring } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => { document.title = 'STILL-care · Your space'; }, []);
  if (restoring) return <main id="main-content" className="session-loading" role="status">Checking your session…</main>;
  if (!user) return <Navigate to="/login?role=patient" replace />;
  if (user.role !== 'patient') return <Navigate to={destinationFor(user.role)} replace />;
  return <div className="patient-shell">
    <header className="patient-header">
      <Link to="/patient" className="patient-brand" aria-label="STILL-care — Your dashboard">
        <img src="/illustrations/brand-mark.svg" width="74" height="74" alt="" />
        <span>STILL-care</span>
      </Link>
      <div className="patient-mission"><p>Safety, Trust &amp; Intervention for longitudinal Life-Care</p><em>STILL here. STILL heard. STILL supported.</em></div>
      <nav className="patient-nav" aria-label="Your account">
        <Link to="/patient/consultant" aria-current={pathname === '/patient/consultant' ? 'page' : undefined}><Headset aria-hidden="true" /><span>Talk to<br className="nav-break" /> Consultant</span></Link>
        <Link to="/patient/profile" aria-current={pathname === '/patient/profile' ? 'page' : undefined}><UserRound aria-hidden="true" /><span>Profile</span></Link>
      </nav>
      <svg className="header-wave" viewBox="0 0 1600 180" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="header-green"><stop stopColor="#e8f4dc" /><stop offset="1" stopColor="#b0d892" /></linearGradient></defs><path d="M0 85C190 194 358 148 556 135S800 116 929 124 1133-16 1277 14 1483 76 1600 0V135C1441 253 1225 78 1096 109S889 159 701 139 366 165 202 164 57 141 0 143Z" fill="url(#header-green)" /><path d="M0 124c227 74 340 16 545 12s233 29 411-8C776 181 707 144 552 143S235 199 0 148Z" fill="#7ebd5c" opacity=".65" /></svg>
    </header>
    <main id="main-content" className="patient-main"><Outlet /></main>
    <svg className="dashboard-waves" viewBox="0 0 1600 200" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="footer-green" x2="1" y2="1"><stop stopColor="#e3f2d7" /><stop offset="1" stopColor="#83be63" /></linearGradient></defs>
      <path d="M0 19c173-43 292 150 495 119S793 41 981 88 1316 17 1600 0v200H0Z" fill="#eff7e9" />
      <path d="M0 56c145-8 268 92 435 54s247 42 401 74S1126 90 1265 110 1460 50 1600 58v142H0Z" fill="url(#footer-green)" />
      <path d="M0 104c163 12 315 90 492 70s310-91 499-57 294 121 609 43v40H0Z" fill="#8cc76b" opacity=".65" />
    </svg>
  </div>;
}
