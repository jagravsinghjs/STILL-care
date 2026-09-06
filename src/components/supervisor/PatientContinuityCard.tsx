/**
 * STILL-care Patient Continuity Card
 *
 * Supervisor-facing patient cohort card showing:
 * - Patient/student name
 * - Last check-in date
 * - Latest reflection mode (Written or Voice)
 * - Current semantic continuity state (Stable, Monitoring, Increasing concern)
 * - Recent trend direction (Improving, Worsening, No clear change)
 * - Short high-level continuity observation
 * - Action button to view the patient's continuity page
 *
 * PRIVACY GUARANTEE:
 * Does NOT expose raw patient reflections or conversation transcripts.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  PenLine,
  Mic,
  ArrowRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { SupervisorPatient } from '../../types';
import { RiskBadge, TrendBadge } from '../common/Badge';

interface PatientContinuityCardProps {
  key?: React.Key;
  patient: SupervisorPatient;
}

export function PatientContinuityCard({ patient }: PatientContinuityCardProps) {
  const isVoice = patient.latestSessionMode === 'voice';

  // Format date
  const dateObj = new Date(patient.lastCheckInDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const isConcern = patient.currentRiskLevel === 'red';
  const isMonitoring = patient.currentRiskLevel === 'yellow';

  return (
    <article
      id={`patient-card-${patient.id}`}
      className={`border rounded-lg p-5 sm:p-6 transition-all duration-150 ${
        isConcern
          ? 'bg-bone border-risk-red/30 shadow-2xs hover:border-risk-red/60'
          : isMonitoring
          ? 'bg-bone border-risk-amber/30 shadow-2xs hover:border-risk-amber/60'
          : 'bg-bone border-charcoal/15 shadow-2xs hover:border-charcoal/30'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left: Patient Name, Meta, Semantic Badges */}
        <div className="space-y-3 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-serif text-lg sm:text-xl font-semibold text-charcoal tracking-tight">
              {patient.name}
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              <RiskBadge
                level={patient.currentRiskLevel}
                trend={patient.distressTrend}
                showTrendIcon={true}
              />
              <TrendBadge trend={patient.distressTrend} />
            </div>
          </div>

          {/* Last Check-in details */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal/70">
            <span className="font-medium text-charcoal/90">Last check-in:</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-charcoal/50" aria-hidden="true" />
              <span>{formattedDate}</span>
            </div>
            <span className="text-charcoal/30" aria-hidden="true">·</span>
            <div className="inline-flex items-center gap-1 bg-paper-grey px-2 py-0.5 rounded border border-charcoal/10 font-medium">
              {isVoice ? (
                <>
                  <Mic className="w-3 h-3 text-slate-teal" aria-hidden="true" />
                  <span>Voice reflection</span>
                </>
              ) : (
                <>
                  <PenLine className="w-3 h-3 text-charcoal/70" aria-hidden="true" />
                  <span>Written reflection</span>
                </>
              )}
            </div>
          </div>

          {/* High-level Care Continuity Observation */}
          <div className="bg-paper-grey/70 border border-charcoal/10 rounded p-3 text-xs space-y-1">
            <span className="text-[11px] font-medium text-charcoal/60 uppercase tracking-wider block">
              Recent continuity observation:
            </span>
            <p className="text-charcoal/85 leading-relaxed italic">
              "{patient.latestObservation || 'Routine check-in logged. No acute distress observed.'}"
            </p>
          </div>
        </div>

        {/* Right: Action Button */}
        <div className="md:self-center shrink-0 pt-2 md:pt-0">
          <Link
            to={`/supervisor/patients/${patient.id}`}
            id={`view-continuity-btn-${patient.id}`}
            className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-4 py-2.5 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            aria-label={`View continuity page for ${patient.name}`}
          >
            <span>View continuity</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
