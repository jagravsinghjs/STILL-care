/**
 * STILL-care Supervisor Alert Card
 *
 * Displays an actionable notification triggered by worsening multi-session distress patterns:
 * - Patient name
 * - Semantic continuity state (Increasing concern / Monitoring)
 * - Distress trend
 * - Multi-session context reason
 * - Recurring plain-language themes
 * - Suggested continuity action
 * - [View patient] and [Mark reviewed] buttons
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { SupervisorAlert } from '../../types';
import { RiskBadge, TrendBadge } from '../common/Badge';

interface AlertCardProps {
  key?: React.Key;
  alert: SupervisorAlert;
  onMarkReviewed: (alertId: string) => void;
}

export function AlertCard({ alert, onMarkReviewed }: AlertCardProps) {
  const isReviewed = alert.isRead;

  // Format date
  const dateObj = new Date(alert.date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const isConcern = alert.riskLevel === 'red';

  return (
    <article
      id={`alert-card-${alert.id}`}
      className={`border rounded-lg p-5 sm:p-6 transition-all duration-150 ${
        isReviewed
          ? 'bg-paper-grey/40 border-charcoal/15 opacity-80'
          : isConcern
          ? 'bg-bone border-risk-red/40 shadow-2xs'
          : 'bg-bone border-risk-amber/40 shadow-2xs'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left: Patient, Badges, Reason, Themes */}
        <div className="space-y-3 flex-1">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-serif text-lg font-semibold text-charcoal tracking-tight">
                {alert.patientName}
              </h3>
              <RiskBadge
                level={alert.riskLevel}
                trend={alert.distressTrend}
                showTrendIcon={true}
              />
              <TrendBadge trend={alert.distressTrend} />
            </div>

            <div className="flex items-center gap-2 text-xs text-charcoal/60">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{formattedDate}</span>
              {isReviewed && (
                <span className="inline-flex items-center gap-1 bg-risk-green/15 text-risk-green px-2 py-0.5 rounded text-[11px] font-medium border border-risk-green/25">
                  <CheckCircle2 className="w-3 h-3" />
                  Reviewed
                </span>
              )}
            </div>
          </div>

          {/* Context Reason */}
          <p className="text-xs sm:text-sm text-charcoal/85 leading-relaxed">
            {alert.reason}
          </p>

          {/* Recurring Themes */}
          {alert.recurringThemes && alert.recurringThemes.length > 0 && (
            <div className="bg-paper-grey/70 border border-charcoal/10 rounded p-3 text-xs space-y-1.5">
              <span className="text-[11px] font-medium text-charcoal/60 uppercase tracking-wider block">
                Recent check-ins show recurring references to:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-charcoal/80 pl-1">
                {alert.recurringThemes.map((theme, i) => (
                  <li key={i} className="capitalize">
                    {theme}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Continuity Action */}
          {alert.suggestedAction && (
            <div className="text-xs bg-slate-teal/10 border border-slate-teal/20 rounded p-3 space-y-0.5">
              <span className="text-[10px] font-semibold text-slate-teal uppercase tracking-wider block">
                Suggested continuity action:
              </span>
              <p className="text-charcoal font-medium">
                {alert.suggestedAction}
              </p>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 pt-2 md:pt-0">
          <Link
            to={`/supervisor/patients/${alert.patientId}`}
            id={`view-patient-alert-${alert.id}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            aria-label={`View continuity for ${alert.patientName}`}
          >
            <span>View patient</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>

          {!isReviewed && (
            <button
              type="button"
              id={`mark-reviewed-btn-${alert.id}`}
              onClick={() => onMarkReviewed(alert.id)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-bone border border-charcoal/25 text-charcoal hover:bg-paper-grey text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
              <span>Mark reviewed</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
