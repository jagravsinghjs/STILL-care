/**
 * STILL-care Supervisor Recommendation Card
 *
 * Displays a non-diagnostic care-continuity recommendation.
 * Framed strictly as care-support actions, NOT medical or clinical diagnoses.
 * Zero numeric mental health scores.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RecommendationItem } from '../../types';

interface RecommendationCardProps {
  key?: React.Key;
  recommendation: RecommendationItem;
  onUpdateStatus: (id: string, status: 'pending' | 'addressed') => void;
}

export function RecommendationCard({
  recommendation,
  onUpdateStatus
}: RecommendationCardProps) {
  const isAddressed = recommendation.status === 'addressed';

  return (
    <article
      id={`recommendation-card-${recommendation.id}`}
      className={`border rounded-lg p-5 sm:p-6 transition-all duration-150 ${
        isAddressed
          ? 'bg-paper-grey/40 border-charcoal/15 opacity-75'
          : 'bg-bone border-charcoal/20 shadow-2xs hover:border-charcoal/35'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left: Content */}
        <div className="space-y-2.5 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-slate-teal/15 text-slate-teal border border-slate-teal/20">
                <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
              <h3 className="font-serif text-base sm:text-lg font-semibold text-charcoal">
                {recommendation.patientName}
              </h3>
            </div>

            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${
                isAddressed
                  ? 'bg-risk-green/15 text-risk-green border-risk-green/25'
                  : 'bg-charcoal/10 text-charcoal/80 border-charcoal/20'
              }`}
            >
              {isAddressed ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Addressed</span>
                </>
              ) : (
                <span>Pending review</span>
              )}
            </span>
          </div>

          {/* Suggested Action */}
          <div className="bg-paper-grey/60 border border-charcoal/10 rounded p-3 text-xs sm:text-sm space-y-1">
            <span className="text-[10px] font-semibold text-slate-teal uppercase tracking-wider block">
              Suggested continuity action:
            </span>
            <p className="font-medium text-charcoal">
              {recommendation.suggestedAction}
            </p>
          </div>

          {/* Context Reason */}
          <p className="text-xs text-charcoal/70 leading-relaxed pl-1">
            <span className="font-medium text-charcoal/80">Context: </span>
            {recommendation.contextReason}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 pt-2 md:pt-0">
          <Link
            to={`/supervisor/patients/${recommendation.patientId}`}
            id={`view-patient-rec-${recommendation.id}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            aria-label={`View continuity for ${recommendation.patientName}`}
          >
            <span>View patient</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>

          {!isAddressed ? (
            <button
              type="button"
              id={`address-rec-btn-${recommendation.id}`}
              onClick={() => onUpdateStatus(recommendation.id, 'addressed')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-bone border border-charcoal/25 text-charcoal hover:bg-paper-grey text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
              <span>Mark addressed</span>
            </button>
          ) : (
            <button
              type="button"
              id={`reopen-rec-btn-${recommendation.id}`}
              onClick={() => onUpdateStatus(recommendation.id, 'pending')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reopen</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
