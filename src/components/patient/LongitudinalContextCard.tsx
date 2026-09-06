/**
 * STILL-care Longitudinal Context Component
 *
 * Reinforces that STILL-care understands patterns across check-ins over time,
 * not just an isolated moment.
 *
 * Provides a lightweight, non-numeric trend view with dates and semantic states.
 * No complex analytics charts or diagnostic scores.
 */

import { Link } from 'react-router-dom';
import { GitCommit, ArrowRight } from 'lucide-react';
import { CheckInSession } from '../../types';
import { StatusDot } from '../common/Status';

interface LongitudinalContextCardProps {
  sessions: CheckInSession[];
}

export function LongitudinalContextCard({ sessions }: LongitudinalContextCardProps) {
  // Sort oldest to newest for chronological left-to-right reading
  const chronologicalSessions = [...sessions]
    .slice(0, 4)
    .reverse();

  return (
    <section
      id="longitudinal-context-card"
      aria-labelledby="continuity-title"
      className="p-5 bg-paper-grey/40 border border-charcoal/15 rounded-md space-y-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-slate-teal" aria-hidden="true" />
          <h2 id="continuity-title" className="text-sm font-medium text-charcoal">
            Continuity across check-ins
          </h2>
        </div>
        <span className="text-xs text-charcoal/50 font-mono">
          {sessions.length} recorded session{sessions.length === 1 ? '' : 's'}
        </span>
      </div>

      <p className="text-xs sm:text-sm text-charcoal/80 leading-relaxed font-sans">
        STILL-care observes patterns across sessions over time rather than evaluating an isolated
        conversation. Tracking gradual changes in fatigue and cognitive demand gives your care team
        helpful context before stress becomes difficult to carry.
      </p>

      {/* Lightweight chronological session indicators */}
      {chronologicalSessions.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {chronologicalSessions.map((s, idx) => {
              const dateStr = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });

              const semanticLabel =
                s.riskLevel === 'green'
                  ? 'Stable'
                  : s.riskLevel === 'yellow'
                  ? 'Monitoring'
                  : 'Increasing concern';

              return (
                <div
                  key={s.id}
                  className="flex flex-col items-center flex-1 min-w-[70px] text-center p-2 rounded bg-bone/70 border border-charcoal/10"
                >
                  <span className="text-[11px] text-charcoal/60 font-mono mb-1">{dateStr}</span>
                  <div className="flex items-center gap-1 my-0.5">
                    <StatusDot status={s.riskLevel} size="sm" />
                    <span className="text-xs font-medium text-charcoal/90">{semanticLabel}</span>
                  </div>
                  <span className="text-[10px] text-charcoal/50 capitalize mt-0.5">
                    {s.mode}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discreet link to reports */}
      <div className="pt-2 border-t border-charcoal/10 flex items-center justify-between text-xs">
        <span className="text-charcoal/60">Comprehensive trends and summaries</span>
        <Link
          id="view-reports-link"
          to="/patient/reports"
          className="inline-flex items-center gap-1 font-medium text-charcoal hover:text-charcoal/70 transition-colors"
        >
          <span>View reflections & reports</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
