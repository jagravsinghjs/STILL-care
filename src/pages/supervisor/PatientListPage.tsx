/**
 * STILL-care Supervisor Patient Cohort List (/supervisor/patients)
 *
 * Displays assigned students sorted by continuity priority:
 * 1. "Increasing concern" appears first
 * 2. "Monitoring" appears next
 * 3. "Stable" appears after them
 * Within the same state: most recently active first.
 *
 * STRICT PRIVACY:
 * Never receives or exposes raw patient reflections or transcripts.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { PatientContinuityCard } from '../../components/supervisor/PatientContinuityCard';
import {
  LoadingState,
  EmptyState,
  ErrorState
} from '../../components/common/FeedbackStates';

export default function PatientListPage() {
  const { patients, isLoading, error, loadSupervisorData } = useSupervisorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'needs_attention' | 'stable'>('all');

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  // Counts for tabs
  const needsAttentionCount = useMemo(
    () => patients.filter((p) => p.currentRiskLevel === 'red' || p.currentRiskLevel === 'yellow').length,
    [patients]
  );
  const stableCount = useMemo(
    () => patients.filter((p) => p.currentRiskLevel === 'green').length,
    [patients]
  );

  // Filtered list
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // Search filter
      const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Mode filter
      if (filterMode === 'needs_attention') {
        return patient.currentRiskLevel === 'red' || patient.currentRiskLevel === 'yellow';
      }
      if (filterMode === 'stable') {
        return patient.currentRiskLevel === 'green';
      }
      return true;
    });
  }, [patients, searchQuery, filterMode]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
            Assigned member cohort
          </h1>
          <p className="text-xs sm:text-sm text-charcoal/70 mt-1">
            Prioritized by care continuity need. Most recently active members shown first within each state.
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs text-charcoal/60 bg-paper-grey px-3 py-1.5 rounded border border-charcoal/10 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Care continuity view (transcripts omitted)</span>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && patients.length === 0 && (
        <LoadingState message="Loading assigned member cohort..." />
      )}

      {/* Error State */}
      {error && patients.length === 0 && (
        <ErrorState
          title="Could not load cohort"
          message={error}
          onRetry={loadSupervisorData}
        />
      )}

      {/* Main Content */}
      {(!isLoading || patients.length > 0) && !error && (
        <>
          {/* Controls: Search & Category Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-bone border border-charcoal/15 rounded-lg p-3 sm:p-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                id="student-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by member name..."
                aria-label="Search members by name"
                className="w-full pl-9 pr-3 py-2 rounded bg-paper-grey/50 border border-charcoal/20 text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
              />
            </div>

            {/* Filter Tabs */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto"
              role="tablist"
              aria-label="Filter member cohort"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'all'}
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap min-h-[38px] ${
                  filterMode === 'all'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                All members ({patients.length})
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'needs_attention'}
                onClick={() => setFilterMode('needs_attention')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap min-h-[38px] ${
                  filterMode === 'needs_attention'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-risk-amber shrink-0" aria-hidden="true" />
                <span>Needs attention ({needsAttentionCount})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'stable'}
                onClick={() => setFilterMode('stable')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap min-h-[38px] ${
                  filterMode === 'stable'
                    ? 'bg-charcoal text-bone'
                    : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-risk-green shrink-0" aria-hidden="true" />
                <span>Stable ({stableCount})</span>
              </button>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs text-charcoal/60 px-1">
            <span>Showing {filteredPatients.length} of {patients.length} assigned members</span>
            <span className="text-[11px] italic">
              Priority sorting: Increasing concern → Monitoring → Stable
            </span>
          </div>

          {/* Patient Cards List */}
          {filteredPatients.length === 0 ? (
            <EmptyState
              title="No members match this view"
              description={
                searchQuery
                  ? `No members found matching "${searchQuery}". Try clearing the search.`
                  : filterMode === 'needs_attention'
                  ? 'No members currently require escalated attention.'
                  : 'No member records in this view.'
              }
              actionLabel={searchQuery || filterMode !== 'all' ? 'Reset filters' : undefined}
              onAction={
                searchQuery || filterMode !== 'all'
                  ? () => {
                      setSearchQuery('');
                      setFilterMode('all');
                    }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-4" role="feed" aria-label="Prioritized member cohort list">
              {filteredPatients.map((patient) => (
                <PatientContinuityCard key={patient.id} patient={patient} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
