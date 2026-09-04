/**
 * STILL-care Supervisor Patient Longitudinal Timeline
 *
 * Visualizes the longitudinal sequence of check-ins for a student.
 * STRICT PRIVACY REQUIREMENT:
 * Operates purely on SupervisorSessionSummary (which omits raw transcript).
 * Never renders private patient reflections or transcripts.
 */

import React from 'react';
import {
  PenLine,
  Mic,
  ArrowDown,
  Clock,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { SupervisorSessionSummary } from '../../types';
import { RiskBadge, TrendBadge } from '../common/Badge';

interface PatientLongitudinalTimelineProps {
  sessions: SupervisorSessionSummary[];
}

export function PatientLongitudinalTimeline({ sessions }: PatientLongitudinalTimelineProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="bg-bone border border-charcoal/15 rounded-lg p-6 text-center">
        <p className="text-sm text-charcoal/70">No longitudinal check-ins recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
        <h3 className="font-serif text-base font-semibold text-charcoal">
          Longitudinal check-in context
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] text-charcoal/60 bg-paper-grey px-2 py-0.5 rounded border border-charcoal/10">
          <ShieldCheck className="w-3 h-3 text-slate-teal" aria-hidden="true" />
          Supervisor continuity view (private words protected)
        </span>
      </div>

      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:top-3 before:bottom-3 before:left-3 sm:before:left-4 before:w-0.5 before:bg-charcoal/15">
        {sessions.map((session, index) => {
          const isVoice = session.mode === 'voice';
          const isLatest = index === 0;

          // Format readable date
          const dateObj = new Date(session.date + 'T00:00:00');
          const formattedDate = dateObj.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric'
          });

          return (
            <div key={session.id} className="relative group">
              {/* Timeline node icon */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full border-2 bg-bone flex items-center justify-center transition-colors ${
                  session.riskLevel === 'red'
                    ? 'border-risk-red text-risk-red'
                    : session.riskLevel === 'yellow'
                    ? 'border-risk-amber text-risk-amber'
                    : 'border-risk-green text-risk-green'
                }`}
                aria-hidden="true"
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    session.riskLevel === 'red'
                      ? 'bg-risk-red'
                      : session.riskLevel === 'yellow'
                      ? 'bg-risk-amber'
                      : 'bg-risk-green'
                  }`}
                />
              </div>

              {/* Session Card */}
              <article
                className={`border rounded-lg p-4 sm:p-5 transition-shadow ${
                  isLatest
                    ? 'bg-paper-grey/50 border-charcoal/25 shadow-2xs'
                    : 'bg-bone border-charcoal/15'
                }`}
              >
                {/* Meta header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-sm font-semibold text-charcoal">
                      {formattedDate}
                    </span>
                    <span className="text-charcoal/30" aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-xs text-charcoal/70 bg-bone px-2 py-0.5 rounded border border-charcoal/10">
                      {isVoice ? (
                        <>
                          <Mic className="w-3 h-3 text-slate-teal" aria-hidden="true" />
                          <span>Voice</span>
                        </>
                      ) : (
                        <>
                          <PenLine className="w-3 h-3 text-charcoal/70" aria-hidden="true" />
                          <span>Written</span>
                        </>
                      )}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] font-semibold text-charcoal/70 uppercase tracking-wider bg-charcoal/10 px-1.5 py-0.2 rounded">
                        Latest
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <RiskBadge
                      level={session.riskLevel}
                      trend={session.distressTrend}
                      showTrendIcon={true}
                    />
                    <TrendBadge trend={session.distressTrend} />
                  </div>
                </div>

                {/* Care Continuity Observation */}
                <div className="bg-bone rounded border border-charcoal/10 p-3 text-xs sm:text-sm text-charcoal/85 leading-relaxed space-y-1">
                  <span className="text-[10px] font-medium text-charcoal/50 uppercase tracking-wider block">
                    Care continuity observation:
                  </span>
                  <p className="italic text-charcoal/90">
                    "{session.plainLanguageReason || session.summary}"
                  </p>
                </div>
              </article>

              {/* Visual connector down arrow if not last */}
              {index < sessions.length - 1 && (
                <div className="flex justify-center my-1 text-charcoal/30" aria-hidden="true">
                  <ArrowDown className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
