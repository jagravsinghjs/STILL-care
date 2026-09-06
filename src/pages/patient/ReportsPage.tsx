/**
 * STILL-care Longitudinal Reflections & Reports Page
 * Route: /patient/reports
 *
 * Requirements:
 * - Non-numeric longitudinal visualization / timeline based on existing session data
 * - Semantic states only (Stable, Monitoring, Increasing concern)
 * - Plain-language recurring themes across sessions
 * - Non-diagnostic explanations of change over time
 * - Strictly NO numerical scores, percentages, depression/anxiety scores, or AI confidence scores
 * - Links back to: Dashboard, History, New Check-In
 * - Calm, accessible STILL-care design language
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Plus, History, ArrowLeft, GitCommit } from 'lucide-react';
import { usePatientStore } from '../../store/patientStore';
import {
  LongitudinalTimeline,
  ThemeAnalysisCard,
  LongitudinalNarrative
} from '../../components/patient/reports';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/FeedbackStates';

export default function ReportsPage() {
  const { currentPatient, sessions, isLoading, loadPatientData } = usePatientStore();
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);

  useEffect(() => {
    if (!currentPatient) {
      loadPatientData('pat-1').catch(() => {
        setHasLoadError(true);
      });
    }
  }, [currentPatient, loadPatientData]);

  if (isLoading && sessions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <LoadingState message="Synthesizing your longitudinal reflection themes..." />
      </div>
    );
  }

  if (hasLoadError && sessions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <ErrorState
          title="Unable to load longitudinal insights"
          message="We were unable to retrieve your session timeline. Please try again."
          onRetry={() => {
            setHasLoadError(false);
            loadPatientData('pat-1');
          }}
        />
      </div>
    );
  }

  return (
    <div
      id="patient-reports-page"
      className="max-w-4xl mx-auto space-y-7 font-sans animate-fade-in py-2"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-teal" aria-hidden="true" />
            <h1 id="reports-page-heading" className="font-serif text-2xl sm:text-3xl text-charcoal font-normal">
              Reflections & longitudinal insights
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            A quiet space to understand how your energy, experiences, and themes have shifted across check-ins over time.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/patient/history"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-medium bg-bone border border-charcoal/20 text-charcoal hover:bg-paper-grey/50 transition-colors min-h-[44px]"
          >
            <History className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
            <span>Check-in history</span>
          </Link>

          <Link
            to="/patient/checkin/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-medium bg-charcoal text-bone hover:bg-charcoal/90 transition-colors min-h-[44px]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New check-in</span>
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No reflections recorded yet"
          description="Longitudinal insights become visible once you have recorded one or more check-in sessions. Take a moment to record your first reflection."
          actionLabel="Start a check-in"
          onAction={() => {
            window.location.href = '/patient/checkin/new';
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Non-numeric Longitudinal Timeline Visualization */}
          <LongitudinalTimeline sessions={sessions} />

          {/* Section 2: Plain-language Recurring Themes */}
          <ThemeAnalysisCard sessions={sessions} />

          {/* Section 3: Longitudinal Care Narrative & Return Navigation Links */}
          <LongitudinalNarrative />
        </div>
      )}
    </div>
  );
}
