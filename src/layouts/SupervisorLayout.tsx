/**
 * STILL-care Supervisor Layout
 *
 * Atmosphere: Focused, trustworthy, fast to scan. Professional clinical working tool.
 * High information hierarchy, high contrast, sentence-case navigation.
 *
 * Supervisor navigation:
 * - Overview (/supervisor/dashboard)
 * - Patients (/supervisor/patients)
 * - Alerts (with dynamic notification badge count)
 * - Recommendations
 * - Messages
 * - Settings (Profile)
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import {
  Users,
  Bell,
  TrendingUp,
  Mail,
  Lightbulb,
  CheckCircle2,
  Settings,
  Menu,
  X,
  Stethoscope,
  Activity,
  LayoutDashboard
} from 'lucide-react';
import { IconButton } from '../components/common/IconButton';
import { NotificationBadge } from '../components/common/Status';
import { useSupervisorStore } from '../store/supervisorStore';

export default function SupervisorLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const { alerts, recommendations, loadSupervisorData } = useSupervisorStore();

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  // Unread alerts count
  const unreadAlertsCount = alerts.filter((a) => !a.isRead).length;
  // Pending recommendations count
  const pendingRecsCount = recommendations.filter((r) => r.status === 'pending').length;

  const navLinks = [
    {
      label: 'Overview',
      path: '/supervisor/dashboard',
      icon: LayoutDashboard,
      badge: undefined
    },
    {
      label: 'Patients',
      path: '/supervisor/patients',
      icon: Users,
      badge: undefined
    },
    {
      label: 'Alerts',
      path: '/supervisor/alerts',
      icon: Bell,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      badgeVariant: 'alert' as const
    },
    {
      label: 'Recommendations',
      path: '/supervisor/recommendations',
      icon: Lightbulb,
      badge: pendingRecsCount > 0 ? pendingRecsCount : undefined,
      badgeVariant: 'subtle' as const
    },
    {
      label: 'Messages',
      path: '/supervisor/messages',
      icon: Mail,
      badge: undefined
    },
    {
      label: 'Settings',
      path: '/supervisor/profile',
      icon: Settings,
      badge: undefined
    }
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-bone text-charcoal flex flex-col font-sans selection:bg-slate-teal/20">
      {/* Dense, professional working toolbar */}
      <header className="border-b border-charcoal/15 bg-paper-grey sticky top-0 z-30 transition-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          {/* Brand & Identity */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link
              to="/supervisor/dashboard"
              className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 rounded px-1"
              aria-label="STILL-care Supervisor Workspace"
            >
              <span className="font-serif text-xl tracking-tight text-charcoal font-semibold">
                STILL-care
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-slate-teal text-bone px-2 py-0.5 rounded font-medium">
                <Activity className="w-3 h-3" />
                Supervisor
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav
              className="hidden lg:flex items-center gap-1 text-xs"
              aria-label="Supervisor workspace navigation"
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  location.pathname === link.path ||
                  (link.path === '/supervisor/patients' && location.pathname.startsWith('/supervisor/patient')) ||
                  (link.path === '/supervisor/messages' && location.pathname.includes('/messages'));

                return (
                  <NavLink
                    key={link.label}
                    to={link.path}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 font-medium ${
                      isActive
                        ? 'bg-charcoal text-bone shadow-2xs'
                        : 'text-charcoal/80 hover:text-charcoal hover:bg-charcoal/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 stroke-[1.75]" aria-hidden="true" />
                    <span>{link.label}</span>
                    {link.badge !== undefined && (
                      <NotificationBadge
                        count={link.badge}
                        variant={isActive ? 'charcoal' : link.badgeVariant || 'subtle'}
                        className={isActive ? 'bg-bone text-charcoal' : ''}
                      />
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Supervisor User Status & Mobile Trigger */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-charcoal/80 bg-bone/70 px-2.5 py-1 rounded border border-charcoal/10">
              <Stethoscope className="w-3.5 h-3.5 text-slate-teal" />
              <span>Dr. Meera Iyer</span>
              <span className="text-[10px] bg-paper-grey text-charcoal/70 px-1.5 py-0.2 rounded font-medium border border-charcoal/10">
                Counselor
              </span>
            </div>

            {/* Mobile Menu Trigger */}
            <div className="lg:hidden">
              <IconButton
                icon={isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                variant="secondary"
              />
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            className="lg:hidden border-t border-charcoal/15 bg-paper-grey px-4 py-3 space-y-1 shadow-sm"
            role="dialog"
            aria-label="Supervisor mobile navigation"
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.label}
                  to={link.path}
                  onClick={closeMobileMenu}
                  className={`flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-charcoal text-bone font-medium'
                      : 'text-charcoal/80 hover:bg-charcoal/5 hover:text-charcoal'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{link.label}</span>
                  </div>
                  {link.badge !== undefined && (
                    <NotificationBadge count={link.badge} variant={link.badgeVariant} />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Working View Slot */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6" id="main-content">
        <Outlet />
      </main>

      {/* Audit & Responsibility Notice */}
      <footer className="border-t border-charcoal/10 py-3 bg-paper-grey/60 text-center text-xs text-charcoal/60">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>Clinical oversight tool & distress prediction assistant.</span>
          <span>A human professional remains responsible for intervention decisions.</span>
        </div>
      </footer>
    </div>
  );
}
