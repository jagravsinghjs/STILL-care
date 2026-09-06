/**
 * STILL-care Recent Session Card
 *
 * Displays details of the patient's most recent check-in:
 * - Formatted date
 * - Check-in mode (voice / text)
 * - Restrained plain-language summary
 * - Subtle semantic status badge (Stable, Monitoring, Increasing concern)
 *
 * Strictly avoids numerical distress scores or internal AI telemetry.
 */

import { Link } from 'react-router-dom';
import { Mic, FileText, ArrowUpRight, ArrowRight } from 'lucide-react';
import { CheckInSession } from '../../types';
import { RiskBadge } from '../common/Badge';

interface RecentSessionCardProps {
  session: CheckInSession | null;
}

export function RecentSessionCard({ session }: RecentSessionCardProps) {
  if (!session) {
    return (
      <section
        id="recent-session-card"
        aria-labelledby="recent-session-title"
        className="p-5 bg-bone border border-charcoal/15 rounded-md text-center py-8 space-y-2"
      >
        <p id="recent-session-title" className="text-sm font-medium text-charcoal">
          No previous check-ins recorded yet
        </p>
        <p className="text-xs text-charcoal/60 max-w-sm mx-auto">
          When you complete your first check-in, an overview of your reflections will appear here.
        </p>
      </section>
    );
  }

  // Format date cleanly
  const formattedDate = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const isVoice = session.mode === 'voice';

  return (
    <section
      id="recent-session-card"
      aria-labelledby="recent-session-title"
      className="p-5 sm:p-6 bg-bone border border-charcoal/15 rounded-md space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-xs font-mono uppercase tracking-wider text-charcoal/50">
            Most recent check-in
          </span>
          <h2
            id="recent-session-title"
            className="text-base sm:text-lg font-serif text-charcoal font-medium"
          >
            {formattedDate}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtle mode badge */}
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-paper-grey text-charcoal/80 border border-charcoal/10 font-medium">
            {isVoice ? (
              <>
                <Mic className="w-3 h-3 text-slate-teal" aria-hidden="true" />
                <span>Voice check-in</span>
              </>
            ) : (
              <>
                <FileText className="w-3 h-3 text-clay-soft" aria-hidden="true" />
                <span>Written check-in</span>
              </>
            )}
          </span>

          {/* Semantic Status Badge - No scores or numbers */}
          <RiskBadge
            level={session.riskLevel}
            trend={session.distressTrend}
            showTrendIcon={true}
          />
        </div>
      </div>

      {/* Narrative summary in a restrained, readable box */}
      <div className="p-3.5 bg-paper-grey/50 border border-charcoal/10 rounded">
        <p className="text-xs font-mono uppercase text-charcoal/50 mb-1">
          Session overview
        </p>
        <p className="text-xs sm:text-sm text-charcoal/90 leading-relaxed font-sans">
          "{session.summary}"
        </p>
      </div>

      {/* Navigation action to full reflection history */}
      <div className="flex items-center justify-between pt-1 border-t border-charcoal/10 text-xs">
        <span className="text-charcoal/60">
          Recorded check-in session
        </span>
        <Link
          id="view-session-details-link"
          to="/patient/history"
          className="inline-flex items-center gap-1 font-medium text-charcoal hover:text-charcoal/70 transition-colors"
        >
          <span>View in history</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
