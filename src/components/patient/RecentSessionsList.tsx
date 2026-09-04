/**
 * STILL-care Recent Sessions List Component
 *
 * Displays a concise list of recent check-ins (e.g. 3-4 sessions).
 * Shows date, mode, concise summary, and semantic trend badge.
 * Provides direct action to view full history at /patient/history.
 */

import { Link } from 'react-router-dom';
import { History, ArrowRight, Mic, FileText } from 'lucide-react';
import { CheckInSession } from '../../types';
import { RiskBadge } from '../common/Badge';

interface RecentSessionsListProps {
  sessions: CheckInSession[];
  limit?: number;
}

export function RecentSessionsList({ sessions, limit = 3 }: RecentSessionsListProps) {
  const displayedSessions = sessions.slice(0, limit);

  if (displayedSessions.length === 0) {
    return null;
  }

  return (
    <section
      id="recent-sessions-list-section"
      aria-labelledby="recent-sessions-title"
      className="p-5 sm:p-6 bg-bone border border-charcoal/15 rounded-md space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-charcoal/70" aria-hidden="true" />
          <h2 id="recent-sessions-title" className="text-base font-serif text-charcoal font-medium">
            Recent check-ins
          </h2>
        </div>
        <Link
          id="view-full-history-link"
          to="/patient/history"
          className="text-xs font-medium text-charcoal hover:text-charcoal/70 inline-flex items-center gap-1 transition-colors"
        >
          <span>View history</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>

      <div className="divide-y divide-charcoal/10">
        {displayedSessions.map((session) => {
          const formattedDate = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          return (
            <article
              key={session.id}
              className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2"
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-charcoal/70 font-medium">{formattedDate}</span>
                  <span className="text-charcoal/30">&middot;</span>
                  <span className="inline-flex items-center gap-1 text-charcoal/60">
                    {session.mode === 'voice' ? (
                      <>
                        <Mic className="w-3 h-3" aria-hidden="true" />
                        <span>Voice</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>Written</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-charcoal/80 line-clamp-2 leading-relaxed">
                  {session.summary}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <RiskBadge
                  level={session.riskLevel}
                  trend={session.distressTrend}
                  showTrendIcon={true}
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="pt-2 border-t border-charcoal/10 text-center sm:text-left">
        <Link
          to="/patient/history"
          className="text-xs text-charcoal/70 hover:text-charcoal inline-flex items-center gap-1 font-medium transition-colors"
        >
          <span>See all past check-ins in your history</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
