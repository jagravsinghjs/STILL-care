/**
 * STILL-care Evaluation Perspective Switcher
 *
 * A subtle, floating role switcher designed for evaluation and demonstration.
 * Does not visually intrude upon or dominate the real product layout.
 * Displays real persona identities: Ananya Sharma (Student) and Dr. Meera Iyer (Counselor).
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRightLeft, User, Stethoscope, ChevronUp, ChevronDown, LogIn } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export function JudgeDemoBar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isPatientView = location.pathname.startsWith('/patient');
  const isSupervisorView = location.pathname.startsWith('/supervisor');
  const isLoginPage = location.pathname === '/login';
  const { setActiveRole } = useAppStore();

  // If on login page, keep it completely hidden or ultra-subtle
  if (isLoginPage) {
    return null;
  }

  const handleSwitchToPatient = () => {
    setActiveRole('patient');
  };

  const handleSwitchToSupervisor = () => {
    setActiveRole('supervisor');
  };

  return (
    <div
      aria-label="Evaluation role switcher"
      className="fixed bottom-3 right-3 z-50 font-sans select-none text-xs"
    >
      {/* Expanded Control Box */}
      {isOpen ? (
        <div className="bg-charcoal/95 backdrop-blur-md text-bone border border-charcoal/30 rounded-xl p-3 shadow-xl space-y-2.5 min-w-[240px] animate-fade-in">
          <div className="flex items-center justify-between pb-1.5 border-b border-bone/10">
            <span className="text-[11px] font-medium text-bone/60 uppercase tracking-wider">
              Switch Perspective
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-bone/60 hover:text-bone p-0.5 rounded transition-colors"
              aria-label="Minimize switcher"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <Link
              to="/patient/dashboard"
              onClick={() => {
                handleSwitchToPatient();
                setIsOpen(false);
              }}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                isPatientView
                  ? 'bg-moss text-bone font-medium shadow-2xs'
                  : 'text-bone/80 hover:text-bone hover:bg-bone/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-sage" />
                <span>Student: <strong>Ananya Sharma</strong></span>
              </div>
              {isPatientView && <span className="text-[10px] opacity-75">Active</span>}
            </Link>

            <Link
              to="/supervisor/dashboard"
              onClick={() => {
                handleSwitchToSupervisor();
                setIsOpen(false);
              }}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                isSupervisorView
                  ? 'bg-secondary-green text-bone font-medium shadow-2xs'
                  : 'text-bone/80 hover:text-bone hover:bg-bone/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Stethoscope className="w-3.5 h-3.5 text-bone/70" />
                <span>Counselor: <strong>Dr. Meera Iyer</strong></span>
              </div>
              {isSupervisorView && <span className="text-[10px] opacity-75">Active</span>}
            </Link>
          </div>

          <div className="pt-1.5 border-t border-bone/10 flex items-center justify-between text-[11px] text-bone/60">
            <Link
              to="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 hover:text-bone transition-colors"
            >
              <LogIn className="w-3 h-3" />
              <span>Go to Login Screen</span>
            </Link>
            <span className="text-bone/30">Evaluation mode</span>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Pill */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-charcoal/90 hover:bg-charcoal text-bone/90 hover:text-bone px-3 py-1.5 rounded-full shadow-lg border border-bone/15 backdrop-blur-xs transition-all hover:scale-105"
          title="Click to switch persona (Student / Counselor)"
        >
          <ArrowRightLeft className="w-3 h-3 text-sage" />
          <span className="text-[11px] font-medium">
            {isPatientView ? 'Student View (Ananya)' : isSupervisorView ? 'Counselor View (Dr. Iyer)' : 'Switch Persona'}
          </span>
          <ChevronUp className="w-3 h-3 text-bone/50" />
        </button>
      )}
    </div>
  );
}
