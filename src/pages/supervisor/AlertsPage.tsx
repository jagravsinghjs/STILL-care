/**
 * STILL-care Supervisor Alerts Page (/supervisor/alerts)
 *
 * Dedicated page for multi-session distress trajectory alerts:
 * - Shows alerts triggered by worsening multi-session patterns
 * - Uses semantic states: Increasing concern, Monitoring, Stable
 * - Displays recurring plain-language themes
 * - Provides non-diagnostic continuity action suggestions
 * - Supports marking alerts as reviewed
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  CheckCircle2,
  Filter,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { AlertCard } from '../../components/supervisor/AlertCard';
import {
  LoadingState,
  EmptyState,
  ErrorState
} from '../../components/common/FeedbackStates';

export default function SupervisorAlertsPage() {
  const { alerts, isLoading, error, loadSupervisorData, markAlertReviewed } = useSupervisorStore();

  const [filterMode, setFilterMode] = useState<'unreviewed' | 'all'>('unreviewed');

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  const unreviewedCount = useMemo(() => alerts.filter((a) => !a.isRead).length, [alerts]);

  const filteredAlerts = useMemo(() => {
    if (filterMode === 'unreviewed') {
      return alerts.filter((a) => !a.isRead);
    }
    return alerts;
  }, [alerts, filterMode]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
            Continuity alerts & notifications
          </h1>
          <p className="text-xs sm:text-sm text-charcoal/70 mt-1">
            Notifications triggered by multi-session distress patterns across your caseload.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-charcoal/60 bg-paper-grey px-3 py-1.5 rounded border border-charcoal/10 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Non-diagnostic pattern alerts</span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && alerts.length === 0 && (
        <LoadingState message="Loading continuity alerts..." />
      )}

      {/* Error State */}
      {error && alerts.length === 0 && (
        <ErrorState
          title="Could not load alerts"
          message={error}
          onRetry={loadSupervisorData}
        />
      )}

      {/* Main Content */}
      {(!isLoading || alerts.length > 0) && !error && (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-3 bg-bone border border-charcoal/15 rounded-lg p-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Filter alerts">
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'unreviewed'}
                onClick={() => setFilterMode('unreviewed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[38px] ${
                  filterMode === 'unreviewed'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Unreviewed alerts ({unreviewedCount})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'all'}
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[38px] ${
                  filterMode === 'all'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                All alerts ({alerts.length})
              </button>
            </div>

            <span className="text-xs text-charcoal/60 hidden sm:inline">
              {filteredAlerts.length} {filteredAlerts.length === 1 ? 'alert' : 'alerts'} shown
            </span>
          </div>

          {/* Alert List */}
          {filteredAlerts.length === 0 ? (
            <EmptyState
              title={filterMode === 'unreviewed' ? 'All alerts reviewed' : 'No alerts recorded'}
              description={
                filterMode === 'unreviewed'
                  ? 'All continuity trajectory alerts have been marked as reviewed.'
                  : 'No alerts currently logged in the supervisor workspace.'
              }
              actionLabel={filterMode === 'unreviewed' ? 'View all historical alerts' : undefined}
              onAction={filterMode === 'unreviewed' ? () => setFilterMode('all') : undefined}
            />
          ) : (
            <div className="space-y-4" role="feed" aria-label="Continuity alerts list">
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onMarkReviewed={markAlertReviewed}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
