/**
 * STILL-care Supervisor Session Summaries & Explainable Continuity Page
 * Route: /supervisor/patient/:id/summaries
 *
 * Longitudinal Session Summary Explorer:
 * - Provides supervising clinicians (Dr. Meera Iyer) with deep, explainable insight
 *   into each student check-in session across time.
 * - STRICT ARCHITECTURAL PRIVACY GUARANTEE:
 *   Raw conversation audio and word-for-word transcripts are permanently omitted.
 *   Supervisors inspect high-level summaries, plain-language semantic reasons,
 *   recurring themes, and distress trends.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Calendar,
  Clock,
  Mic,
  PenLine,
  Filter,
  Search,
  Mail,
  TrendingUp,
  Tag,
  AlertTriangle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { RiskBadge, TrendBadge } from '../../components/common/Badge';
import { LoadingState, EmptyState, ErrorState } from '../../components/common/FeedbackStates';

export default function SessionSummariesPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id || 'pat-1';
  const navigate = useNavigate();

  const {
    patients,
    activePatient,
    activePatientSessions,
    isLoading,
    error,
    loadSupervisorData,
    loadPatientDetail
  } = useSupervisorStore();

  const [filterState, setFilterState] = useState<'all' | 'concern' | 'stable'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSupervisorData();
    loadPatientDetail(patientId);
  }, [patientId, loadSupervisorData, loadPatientDetail]);

  const currentPatient = activePatient || patients.find((p) => p.id === patientId);

  if (isLoading && !currentPatient) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <LoadingState message="Retrieving longitudinal session summaries..." />
      </div>
    );
  }

  if (error && !currentPatient) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <ErrorState
          title="Could not load session summaries"
          message={error}
          onRetry={() => loadPatientDetail(patientId)}
        />
      </div>
    );
  }

  // Filter sessions
  const filteredSessions = activePatientSessions.filter((session) => {
    const matchesFilter =
      filterState === 'all'
        ? true
        : filterState === 'concern'
        ? session.riskLevel === 'yellow' || session.riskLevel === 'red'
        : session.riskLevel === 'green';

    const matchesSearch =
      searchTerm.trim() === '' ||
      session.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.plainLanguageReason.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div
      id="supervisor-session-summaries-page"
      className="max-w-5xl mx-auto space-y-6 font-sans animate-fade-in py-2"
    >
      {/* Wayfinding Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/supervisor/patients/${patientId}`}
              className="text-charcoal/60 hover:text-charcoal transition-colors p-1 -ml-1 rounded focus-visible:ring-1 focus-visible:ring-charcoal"
              aria-label="Back to member continuity view"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <FileText className="w-5 h-5 text-slate-teal" aria-hidden="true" />
            <h1 className="font-serif text-2xl sm:text-3xl text-charcoal font-semibold tracking-tight">
              Session summaries & explanations
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            Explainable longitudinal summaries for member{' '}
            <strong className="text-charcoal font-medium">{currentPatient?.name || 'Member'}</strong>.
          </p>
        </div>

        {/* Quick links & member switcher */}
        <div className="flex items-center gap-2">
          <Link
            to={`/supervisor/patient/${patientId}/trends`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-paper-grey text-charcoal hover:bg-charcoal/10 border border-charcoal/15 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-slate-teal" />
            <span>Longitudinal trends</span>
          </Link>
          <Link
            to={`/supervisor/patient/${patientId}/messages`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-charcoal text-bone hover:bg-charcoal/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Direct message</span>
          </Link>
        </div>
      </div>

      {/* Member Header & Caseload Switcher */}
      <div className="bg-bone border border-charcoal/15 rounded-lg p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-teal/10 border border-slate-teal/20 flex items-center justify-center text-slate-teal font-serif font-bold text-lg">
              {currentPatient?.name
                .split(' ')
                .map((n) => n[0])
                .join('') || 'M'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl font-semibold text-charcoal">
                  {currentPatient?.name}
                </h2>
                {currentPatient && (
                  <RiskBadge
                    level={currentPatient.currentRiskLevel}
                    trend={currentPatient.distressTrend}
                  />
                )}
              </div>
              <p className="text-xs text-charcoal/60">
                Assigned supervisor: <strong className="text-charcoal font-medium">Dr. Meera Iyer</strong> &middot; Last check-in: {currentPatient?.lastCheckInDate}
              </p>
            </div>
          </div>

          {/* Quick Caseload Switcher */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <label htmlFor="caseload-select" className="text-xs text-charcoal/60 font-medium">
              Switch member:
            </label>
            <select
              id="caseload-select"
              value={patientId}
              onChange={(e) => navigate(`/supervisor/patient/${e.target.value}/summaries`)}
              className="p-1.5 text-xs bg-paper-grey border border-charcoal/20 rounded font-medium text-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.currentRiskLevel})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Strict Privacy Shield Banner */}
        <aside
          aria-label="Privacy guarantee"
          className="p-3.5 bg-paper-grey/70 border border-charcoal/10 rounded flex items-start gap-2.5 text-xs text-charcoal/75"
        >
          <ShieldCheck className="w-4 h-4 text-slate-teal shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>Privacy Boundary Enforced:</strong> Raw voice audio and personal transcripts are withheld at the data boundary to protect member safety and trust. Only high-level observations, distress trends, and explainable semantic summaries are presented to the supervisor.
          </p>
        </aside>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bone border border-charcoal/15 rounded-lg p-3">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Filter session summaries">
          <button
            type="button"
            role="tab"
            aria-selected={filterState === 'all'}
            onClick={() => setFilterState('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterState === 'all'
                ? 'bg-charcoal text-bone'
                : 'bg-paper-grey text-charcoal/70 hover:text-charcoal hover:bg-charcoal/10'
            }`}
          >
            All sessions ({activePatientSessions.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterState === 'concern'}
            onClick={() => setFilterState('concern')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterState === 'concern'
                ? 'bg-charcoal text-bone'
                : 'bg-paper-grey text-charcoal/70 hover:text-charcoal hover:bg-charcoal/10'
            }`}
          >
            Needs attention (
            {activePatientSessions.filter((s) => s.riskLevel !== 'green').length}
            )
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterState === 'stable'}
            onClick={() => setFilterState('stable')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterState === 'stable'
                ? 'bg-charcoal text-bone'
                : 'bg-paper-grey text-charcoal/70 hover:text-charcoal hover:bg-charcoal/10'
            }`}
          >
            Stable (
            {activePatientSessions.filter((s) => s.riskLevel === 'green').length}
            )
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search summaries & observations..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bone border border-charcoal/20 rounded text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:ring-1 focus:ring-charcoal"
          />
        </div>
      </div>

      {/* Session Summaries List */}
      {filteredSessions.length === 0 ? (
        <EmptyState
          title="No session summaries match this view"
          description={
            searchTerm
              ? `No summaries found matching "${searchTerm}". Try resetting your search.`
              : 'No sessions recorded for this filter category.'
          }
          actionLabel="Show all sessions"
          onAction={() => {
            setFilterState('all');
            setSearchTerm('');
          }}
        />
      ) : (
        <div className="space-y-4" role="feed" aria-label="Session summaries feed">
          {filteredSessions.map((session, index) => {
            const isVoice = session.mode === 'voice';
            const isLatest = index === 0;
            const dateObj = new Date(session.date + 'T00:00:00');
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <article
                key={session.id}
                className={`bg-bone border rounded-lg p-5 sm:p-6 transition-all space-y-4 ${
                  isLatest
                    ? 'border-charcoal/25 bg-bone shadow-2xs'
                    : 'border-charcoal/15 hover:border-charcoal/25'
                }`}
              >
                {/* Meta Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-serif text-base font-semibold text-charcoal">
                      {formattedDate}
                    </span>
                    <span className="text-charcoal/30" aria-hidden="true">&middot;</span>
                    <span className="inline-flex items-center gap-1 text-xs text-charcoal/70 bg-paper-grey px-2 py-0.5 rounded border border-charcoal/10 font-medium">
                      {isVoice ? (
                        <>
                          <Mic className="w-3 h-3 text-slate-teal" aria-hidden="true" />
                          <span>Voice reflection</span>
                        </>
                      ) : (
                        <>
                          <PenLine className="w-3 h-3 text-slate-teal" aria-hidden="true" />
                          <span>Written reflection</span>
                        </>
                      )}
                    </span>
                    {isLatest && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-charcoal text-bone">
                        Most recent
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <RiskBadge level={session.riskLevel} trend={session.distressTrend} />
                    <TrendBadge trend={session.distressTrend} />
                  </div>
                </div>

                {/* Summary & Reasoning */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-7 space-y-1.5">
                    <h3 className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
                      High-level continuity summary
                    </h3>
                    <p className="text-xs sm:text-sm text-charcoal leading-relaxed">
                      {session.summary}
                    </p>
                  </div>

                  <div className="md:col-span-5 bg-paper-grey/60 border border-charcoal/10 rounded-md p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3 text-slate-teal" />
                      <span>Plain-language reasoning</span>
                    </div>
                    <p className="text-xs text-charcoal/85 leading-relaxed">
                      {session.plainLanguageReason}
                    </p>
                  </div>
                </div>

                {/* Privacy Badge Footer */}
                <div className="pt-2 border-t border-charcoal/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-charcoal/60">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-teal" />
                    <span>Raw transcript protected on member device</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/supervisor/patient/${patientId}/messages`}
                      className="inline-flex items-center gap-1 text-slate-teal hover:text-slate-teal/80 font-medium"
                    >
                      <span>Direct outreach</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
