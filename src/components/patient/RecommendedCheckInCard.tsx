/**
 * STILL-care Recommended Check-In Component
 *
 * Displays suggested timing and a gentle, optional invitation to reflect.
 * Non-demanding tone: reinforces that the patient checks in whenever they feel ready.
 */

import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';

interface RecommendedCheckInCardProps {
  lastCheckInDate?: string;
}

export function RecommendedCheckInCard({ lastCheckInDate }: RecommendedCheckInCardProps) {
  // Format the last check-in date if available
  const formattedLastDate = lastCheckInDate
    ? new Date(lastCheckInDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : 'recently';

  return (
    <section
      id="recommended-checkin-card"
      aria-labelledby="recommended-checkin-title"
      className="p-4 sm:p-5 bg-bone border border-charcoal/15 rounded-md space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-charcoal/70">
          <Clock className="w-3.5 h-3.5 text-moss" aria-hidden="true" />
          <span id="recommended-checkin-title" className="font-medium">
            Next suggested check-in
          </span>
        </div>
        <span className="text-xs text-charcoal/50">Last recorded: {formattedLastDate}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-charcoal/10">
        <div className="space-y-0.5 max-w-xl">
          <p className="text-sm text-charcoal font-medium">
            Today &middot; Evening reflection window
          </p>
          <p className="text-xs text-charcoal/70 leading-relaxed">
            Taking a quiet pause before ending the day helps capture your thoughts without rush.
            Whenever you feel ready.
          </p>
        </div>

        <Link
          id="recommended-checkin-action"
          to="/patient/checkin/new"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-charcoal hover:text-charcoal/80 bg-paper-grey hover:bg-charcoal/10 px-3 py-1.5 rounded border border-charcoal/15 transition-colors self-start sm:self-center shrink-0"
        >
          <span>Begin check-in</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
