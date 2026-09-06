/**
 * STILL-care Patient Layout
 *
 * Atmosphere: Calm, personal, spacious, private, non-clinical.
 * Uses soft bone background (#F5F1E6), charcoal typography, and sentence-case navigation.
 *
 * Mobile-first responsive navigation with drawer toggle, accessible keyboard states,
 * and Lucide icons for gentle visual wayfinding.
 */

import React, { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquarePlus,
  History,
  FileText,
  Mail,
  User,
  Menu,
  X,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { IconButton } from '../components/common/IconButton';

export default function PatientLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: 'Dashboard', path: '/patient/dashboard', icon: LayoutDashboard },
    { label: 'New check-in', path: '/patient/checkin/new', icon: MessageSquarePlus },
    { label: 'History', path: '/patient/history', icon: History },
    { label: 'Reflections & reports', path: '/patient/reports', icon: FileText },
    { label: 'Messages', path: '/patient/messages', icon: Mail },
    { label: 'Supervisor & privacy', path: '/patient/supervisor', icon: Stethoscope },
    { label: 'Profile', path: '/patient/profile', icon: User }
  ];

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-bone text-charcoal flex flex-col font-sans selection:bg-clay-soft/20">
      {/* Calm, quiet navigation bar */}
      <header className="border-b border-charcoal/10 bg-bone/95 backdrop-blur-xs sticky top-0 z-30 transition-shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center gap-6">
            <Link
              to="/patient/dashboard"
              className="flex items-center gap-2.5 group outline-none focus-visible:ring-2 focus-visible:ring-forest/30 rounded px-1"
              aria-label="STILL-care Member Home"
            >
              <div className="w-8 h-8 rounded-full bg-forest text-bone flex items-center justify-center font-serif font-bold text-sm">
                S
              </div>
              <span className="font-serif text-xl tracking-tight text-charcoal font-semibold">
                STILL-care
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-paper-grey text-charcoal/80 px-2 py-0.5 rounded-full border border-charcoal/10">
                <ShieldCheck className="w-3 h-3 text-secondary-green" />
                Member Space
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav
              className="hidden md:flex items-center gap-1 text-xs"
              aria-label="Member navigation"
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-forest/30 ${
                        isActive
                          ? 'bg-paper-grey text-charcoal font-medium shadow-2xs border border-charcoal/10'
                          : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5 stroke-[1.75] opacity-75" aria-hidden="true" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right Header: Notification + Student Profile Avatar */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <Link
              to="/patient/messages"
              className="relative p-2 text-charcoal/70 hover:text-charcoal hover:bg-paper-grey rounded-full transition-colors"
              aria-label="Notifications"
              title="New message from Dr. Meera Iyer"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {/* Subtle indicator dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-forest border-2 border-bone" />
            </Link>

            {/* Student Profile Avatar */}
            <Link
              to="/patient/profile"
              className="flex items-center gap-2 p-1 pr-2.5 rounded-full hover:bg-paper-grey transition-colors text-xs text-charcoal group"
              aria-label="View Ananya's Profile"
            >
              <div className="w-7 h-7 rounded-full bg-sage text-forest flex items-center justify-center font-semibold text-xs border border-border-subtle group-hover:border-forest/40">
                AS
              </div>
              <span className="hidden sm:inline font-medium text-charcoal">Ananya</span>
            </Link>

            {/* Mobile Menu Toggle Button */}
            <div className="md:hidden">
              <IconButton
                icon={isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                variant="subtle"
              />
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden border-t border-charcoal/10 bg-bone px-4 py-3 space-y-1 shadow-sm"
            role="dialog"
            aria-label="Mobile navigation"
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-paper-grey text-charcoal font-medium border border-charcoal/10'
                      : 'text-charcoal/70 hover:bg-charcoal/5 hover:text-charcoal'
                  }`}
                >
                  <Icon className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8" id="main-content">
        <Outlet />
      </main>

      {/* Calm, quiet footer */}
      <footer className="border-t border-charcoal/10 py-5 bg-paper-grey/30 text-center text-xs text-charcoal/60">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>STILL-care &middot; A calmer space to reflect and stay connected</span>
          <span className="text-charcoal/50">Encrypted on-device &middot; Compassionate human care continuity</span>
        </div>
      </footer>
    </div>
  );
}
