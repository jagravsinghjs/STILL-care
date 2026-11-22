import { useEffect, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';

export function AuthLayout({ children, title, backTo, variant = 'login' }: {
  children: ReactNode; title: string; backTo?: string; variant?: 'login' | 'register' | 'other';
}) {
  useEffect(() => { document.title = `STILL-care · ${title}`; window.scrollTo(0, 0); }, [title]);
  return <div className={`auth-page auth-page--${variant}`}>
    <svg className="top-ribbons" viewBox="0 0 940 210" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0h264C132 28 97 103 0 167Z" fill="#dcebd4" />
      <path d="M0 0h150C82 31 55 99 0 135Z" fill="#bad9a6" opacity=".65" />
      <path d="M940 0v125C821 186 734 209 607 203 777 174 858 93 940 0Z" fill="#eaf3e5" />
      <path d="M940 0v125C866 164 801 186 736 194 840 142 908 62 940 0Z" fill="#c8e1b8" opacity=".8" />
    </svg>
    <main className="auth-main" id="main-content">
      {backTo && <Link className="back-link" to={backTo} aria-label="Back to login"><ArrowLeft size={24} /></Link>}
      <Brand />
      {children}
    </main>
    <div className="landscape" aria-hidden="true"><img src="/illustrations/landscape.svg" alt="" width="940" height="370" /></div>
  </div>;
}
