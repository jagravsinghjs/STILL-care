/**
 * STILL-care Longitudinal Narrative and Actions
 *
 * Explains how longitudinal continuity protects patient well-being.
 * Provides explicit navigation back to:
 * - Patient dashboard (/patient/dashboard)
 * - Patient history (/patient/history)
 * - New check-in (/patient/checkin/new)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, MessageSquare, History, Plus, LayoutDashboard } from 'lucide-react';

export function LongitudinalNarrative() {
  return (
    <div
      id="longitudinal-narrative-section"
      className="space-y-6 font-sans"
    >
      {/* Privacy and Care Continuity Card */}
      <div className="p-5 sm:p-6 bg-paper-grey/40 border border-charcoal/15 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-teal" aria-hidden="true" />
          <h3 className="font-serif text-base text-charcoal font-medium">
            How longitudinal care works
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-charcoal/80 leading-relaxed">
          In traditional mental healthcare, support often waits until a person reaches an acute crisis.
          STILL-care is designed around gentle, proactive continuity: by noticing subtle shifts in fatigue and cognitive load across multiple sessions,
          your care supervisor can step forward early with practical listening and support.
        </p>

        <p className="text-xs text-charcoal/70 leading-relaxed border-t border-charcoal/10 pt-2">
          Your private conversation texts remain protected in your personal archive.
          Your supervisor only views aggregated continuity themes and stability indicators, preserving your dignity and comfort.
        </p>
      </div>

      {/* Navigation Quick Links */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <Link
          to="/patient/dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-bone border border-charcoal/20 text-xs font-medium text-charcoal hover:bg-paper-grey/60 transition-colors min-h-[44px]"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Return to dashboard</span>
        </Link>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            to="/patient/history"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-bone border border-charcoal/20 text-xs font-medium text-charcoal hover:bg-paper-grey/60 transition-colors min-h-[44px]"
          >
            <History className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
            <span>View check-in history</span>
          </Link>

          <Link
            to="/patient/checkin/new"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-charcoal text-bone hover:bg-charcoal/90 transition-colors text-xs font-medium min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Record new check-in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
