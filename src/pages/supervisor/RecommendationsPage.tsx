/**
 * STILL-care Supervisor Recommendations Page (/supervisor/recommendations)
 *
 * Provides non-diagnostic continuity recommendations:
 * - Framed strictly as care-support actions, NOT medical decisions
 * - Zero numerical mental health scoring
 * - Allows marking recommendations as addressed or pending
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Lightbulb,
  CheckCircle2,
  Filter,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { RecommendationCard } from '../../components/supervisor/RecommendationCard';
import {
  LoadingState,
  EmptyState,
  ErrorState
} from '../../components/common/FeedbackStates';

export default function SupervisorRecommendationsPage() {
  const {
    recommendations,
    isLoading,
    error,
    loadSupervisorData,
    updateRecommendation
  } = useSupervisorStore();

  const [filterMode, setFilterMode] = useState<'pending' | 'addressed' | 'all'>('pending');

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  const pendingCount = useMemo(
    () => recommendations.filter((r) => r.status === 'pending').length,
    [recommendations]
  );
  const addressedCount = useMemo(
    () => recommendations.filter((r) => r.status === 'addressed').length,
    [recommendations]
  );

  const filteredRecs = useMemo(() => {
    if (filterMode === 'pending') {
      return recommendations.filter((r) => r.status === 'pending');
    }
    if (filterMode === 'addressed') {
      return recommendations.filter((r) => r.status === 'addressed');
    }
    return recommendations;
  }, [recommendations, filterMode]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
            Care continuity recommendations
          </h1>
          <p className="text-xs sm:text-sm text-charcoal/70 mt-1">
            Non-diagnostic support suggestions for counselor review. Framed as care-continuity outreach, not medical decisions.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-charcoal/60 bg-paper-grey px-3 py-1.5 rounded border border-charcoal/10 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Non-diagnostic guidance</span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && recommendations.length === 0 && (
        <LoadingState message="Loading care recommendations..." />
      )}

      {/* Error State */}
      {error && recommendations.length === 0 && (
        <ErrorState
          title="Could not load recommendations"
          message={error}
          onRetry={loadSupervisorData}
        />
      )}

      {/* Main Content */}
      {(!isLoading || recommendations.length > 0) && !error && (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-3 bg-bone border border-charcoal/15 rounded-lg p-3">
            <div className="flex items-center gap-2" role="tablist" aria-label="Filter recommendations">
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'pending'}
                onClick={() => setFilterMode('pending')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[38px] ${
                  filterMode === 'pending'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Pending review ({pendingCount})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'addressed'}
                onClick={() => setFilterMode('addressed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[38px] ${
                  filterMode === 'addressed'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Addressed ({addressedCount})</span>
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
                All ({recommendations.length})
              </button>
            </div>

            <span className="text-xs text-charcoal/60 hidden sm:inline">
              {filteredRecs.length} {filteredRecs.length === 1 ? 'item' : 'items'} shown
            </span>
          </div>

          {/* Recommendations List */}
          {filteredRecs.length === 0 ? (
            <EmptyState
              title={
                filterMode === 'pending'
                  ? 'No pending recommendations'
                  : 'No recommendations found'
              }
              description={
                filterMode === 'pending'
                  ? 'All continuity recommendations have been addressed.'
                  : 'No recommendation records match this filter.'
              }
              actionLabel={filterMode === 'pending' ? 'View all recommendations' : undefined}
              onAction={filterMode === 'pending' ? () => setFilterMode('all') : undefined}
            />
          ) : (
            <div className="space-y-4" role="feed" aria-label="Continuity recommendations list">
              {filteredRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onUpdateStatus={updateRecommendation}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
