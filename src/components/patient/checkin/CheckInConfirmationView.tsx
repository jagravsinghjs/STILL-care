/**
 * STILL-care Check-In Confirmation View
 *
 * Displays a calm, supportive confirmation after check-in submission.
 * Strictly non-diagnostic: No risk scores, no emotion percentages, no AI diagnostic claims.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import { CheckInSession } from '../../../types';

interface CheckInConfirmationViewProps {
  session: CheckInSession | null;
}

export function CheckInConfirmationView({ session }: CheckInConfirmationViewProps) {
  const isVoice = session?.mode === 'voice';

  return (
    <div
      id="checkin-confirmation-card"
      className="max-w-xl mx-auto bg-bone border border-charcoal/15 rounded-lg p-6 sm:p-8 space-y-6 text-center animate-fade-in"
    >
      {/* Visual Indicator */}
      <div className="mx-auto w-14 h-14 rounded-full bg-paper-grey border border-moss/30 flex items-center justify-center text-moss">
        <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
      </div>

      {/* Primary Message */}
      <div className="space-y-2">
        <h2
          id="confirmation-heading"
          className="font-serif text-2xl font-normal text-charcoal"
        >
          Your check-in has been recorded.
        </h2>
        <p className="text-sm text-charcoal/75 leading-relaxed max-w-md mx-auto">
          Thank you for taking this time for yourself. Your reflection has been saved to your private record.
        </p>
      </div>

      {/* Continuity Context */}
      <div className="p-4 bg-paper-grey/70 border border-charcoal/10 rounded text-left space-y-2 text-xs text-charcoal/75">
        <div className="flex items-center gap-1.5 font-medium text-charcoal">
          <Clock className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Care continuity</span>
        </div>
        <p className="leading-relaxed">
          High-level observations and recurring themes from your check-in will be reviewed by your assigned care supervisor to help support your ongoing care continuity.
        </p>
        <div className="pt-2 border-t border-charcoal/10 flex items-center gap-1.5 text-[11px] text-charcoal/60">
          <ShieldCheck className="w-3.5 h-3.5 text-moss shrink-0" aria-hidden="true" />
          <span>
            {isVoice ? 'Spoken reflection preview' : 'Written reflection'} &middot; Private archive
          </span>
        </div>
      </div>

      {/* Action Options */}
      <div className="pt-2 space-y-3">
        <Link
          id="return-to-dashboard-button"
          to="/patient/dashboard"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors min-h-[44px]"
        >
          <span>Return to dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1 text-xs">
          <Link
            id="view-checkin-history-link"
            to="/patient/history"
            className="px-3 py-2 text-charcoal/70 hover:text-charcoal hover:underline transition-colors"
          >
            View your check-in history
          </Link>
          <span className="hidden sm:inline text-charcoal/30">&middot;</span>
          <Link
            id="connect-supervisor-link"
            to="/patient/supervisor"
            className="px-3 py-2 text-charcoal/70 hover:text-charcoal hover:underline transition-colors"
          >
            Connect with supervisor
          </Link>
        </div>
      </div>
    </div>
  );
}
