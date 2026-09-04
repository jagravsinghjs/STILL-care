/**
 * STILL-care Patient Session History Page
 * Route: /patient/history
 *
 * Requirements:
 * - Reverse chronological order of past check-in sessions
 * - Date, Reflection mode (Written or Voice), short plain-language summary
 * - Semantic status (Stable, Monitoring, Increasing concern)
 * - Trend direction
 * - Clear action to open/view the session
 * - Filtering by mode (All, Written, Voice) and date range (All time, 7 days, 30 days)
 * - Expanded detail view with private reflection/transcript and high-level care continuity observations
 * - Privacy protection: No numerical scores, no confidence values, no internal reasoning exposed
 * - Uses existing EmptyState, LoadingState, ErrorState
 * - Fully responsive and mobile-friendly
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { History, Plus, ArrowLeft, TrendingUp, Sparkles } from 'lucide-react';
import { usePatientStore } from '../../store/patientStore';
import {
  SessionHistoryItem,
  HistoryFilterBar,
  ModeFilterType,
  DateRangeFilterType
} from '../../components/patient/history';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/FeedbackStates';
import { Button } from '../../components/common/Button';

export default function HistoryPage() {
  const [searchParams] = useSearchParams();
  const targetSessionId = searchParams.get('session');

  const {
    currentPatient,
    sessions,
    isLoading,
    loadPatientData
  } = usePatientStore();

  const [modeFilter, setModeFilter] = useState<ModeFilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateRangeFilterType>('all');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(targetSessionId || null);
  const [hasLoadError, setHasLoadError] = useState<boolean>(false);

  useEffect(() => {
    if (!currentPatient) {
      loadPatientData('pat-1').catch(() => {
        setHasLoadError(true);
      });
    }
  }, [currentPatient, loadPatientData]);

  // If URL parameter changes, automatically expand that session
  useEffect(() => {
    if (targetSessionId) {
      setExpandedSessionId(targetSessionId);
    }
  }, [targetSessionId]);

  // Filter sessions based on mode and date range
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Filter by mode
    if (modeFilter === 'text') {
      result = result.filter((s) => s.mode === 'text');
    } else if (modeFilter === 'voice') {
      result = result.filter((s) => s.mode === 'voice');
    }

    // Filter by date
    if (dateFilter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter((s) => new Date(s.date + 'T00:00:00') >= sevenDaysAgo);
    } else if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter((s) => new Date(s.date + 'T00:00:00') >= thirtyDaysAgo);
    }

    // Ensure reverse chronological sorting (newest first)
    return result.sort(
      (a, b) => new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime()
    );
  }, [sessions, modeFilter, dateFilter]);

  const handleToggleExpand = (id: string) => {
    setExpandedSessionId((prev) => (prev === id ? null : id));
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <LoadingState message="Retrieving your past reflections..." />
      </div>
    );
  }

  if (hasLoadError && sessions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <ErrorState
          title="Unable to load session history"
          message="We were unable to retrieve your recorded check-in reflections. Please try again."
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
      id="patient-history-page"
      className="max-w-4xl mx-auto space-y-6 font-sans animate-fade-in py-2"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-teal" aria-hidden="true" />
            <h1 id="history-page-heading" className="font-serif text-2xl sm:text-3xl text-charcoal font-normal">
              Check-in history
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            A chronological record of your past personal check-ins, reflections, and care continuity observations.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/patient/reports"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium bg-bone border border-charcoal/20 text-charcoal hover:bg-paper-grey/50 transition-colors min-h-[44px]"
          >
            <TrendingUp className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
            <span>Longitudinal trends</span>
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

      {/* Filter Bar */}
      <HistoryFilterBar
        modeFilter={modeFilter}
        onChangeModeFilter={setModeFilter}
        dateFilter={dateFilter}
        onChangeDateFilter={setDateFilter}
        totalCount={filteredSessions.length}
      />

      {/* Sessions List or Empty State */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          title={
            modeFilter !== 'all' || dateFilter !== 'all'
              ? 'No check-ins match this filter'
              : 'No check-in sessions recorded yet'
          }
          description={
            modeFilter !== 'all' || dateFilter !== 'all'
              ? 'Try adjusting your format or time period filters to view other recorded check-in reflections.'
              : 'Whenever you are ready, you can start a gentle written or spoken reflection to begin your timeline.'
          }
          actionLabel={
            modeFilter !== 'all' || dateFilter !== 'all'
              ? 'Reset filters'
              : 'Start your first check-in'
          }
          onAction={
            modeFilter !== 'all' || dateFilter !== 'all'
              ? () => {
                  setModeFilter('all');
                  setDateFilter('all');
                }
              : () => {
                  window.location.href = '/patient/checkin/new';
                }
          }
        />
      ) : (
        <div className="space-y-3" id="sessions-list" role="feed" aria-label="Past check-in sessions">
          {filteredSessions.map((session) => (
            <SessionHistoryItem
              key={session.id}
              session={session}
              isExpanded={expandedSessionId === session.id}
              onToggleExpand={() => handleToggleExpand(session.id)}
            />
          ))}
        </div>
      )}

      {/* Subtle Privacy & Philosophy Note */}
      <div className="p-4 bg-paper-grey/30 border border-charcoal/10 rounded text-xs text-charcoal/70 space-y-1 mt-6">
        <p className="font-medium text-charcoal">
          Privacy and care continuity
        </p>
        <p className="leading-relaxed">
          Your private reflections and transcripts are never forwarded as raw text to your supervisor.
          Only high-level themes and distress patterns are communicated to your supervisor to help them notice if fatigue or pressure is building up over time.
        </p>
      </div>
    </div>
  );
}
