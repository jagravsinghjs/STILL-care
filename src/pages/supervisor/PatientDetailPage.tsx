/**
 * STILL-care Supervisor Patient Detail & Continuity View (/supervisor/patients/:id)
 *
 * Longitudinal continuity overview for an individual student:
 * - Student name & assigned supervisor (Dr. Meera Iyer)
 * - Current semantic continuity state & last check-in date
 * - Back to patient cohort link
 * - Longitudinal check-in timeline (Date, Mode, Semantic State, Continuity observation, Trend)
 * - Supervisor action panel (Log reach-out, Send supportive message, Request appointment)
 *
 * CRITICAL PRIVACY GUARANTEE:
 * The supervisor data model strictly uses SupervisorSessionSummary which omits
 * the student's private reflections and conversation transcripts.
 */

import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  Stethoscope,
  Mail,
  UserCheck,
  FileText,
  TrendingUp
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { PatientLongitudinalTimeline } from '../../components/supervisor/PatientLongitudinalTimeline';
import { SupervisorActionPanel } from '../../components/supervisor/SupervisorActionPanel';
import { RiskBadge, TrendBadge } from '../../components/common/Badge';
import {
  LoadingState,
  EmptyState,
  ErrorState
} from '../../components/common/FeedbackStates';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id || 'pat-1';
  const navigate = useNavigate();

  const {
    activePatient,
    activePatientSessions,
    activePatientActions,
    isLoading,
    error,
    loadPatientDetail
  } = useSupervisorStore();

  useEffect(() => {
    loadPatientDetail(patientId);
  }, [patientId, loadPatientDetail]);

  if (isLoading && !activePatient) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <LoadingState message="Retrieving student continuity record..." />
      </div>
    );
  }

  if (error && !activePatient) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <ErrorState
          title="Unable to load student continuity"
          message={error}
          onRetry={() => loadPatientDetail(patientId)}
        />
      </div>
    );
  }

  if (!activePatient) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <EmptyState
          title="Student not found"
          description={`No student record found with ID "${patientId}".`}
          actionLabel="Back to patient cohort"
          onAction={() => navigate('/supervisor/patients')}
        />
      </div>
    );
  }

  const dateObj = new Date(activePatient.lastCheckInDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Wayfinding Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/supervisor/patients"
          id="back-to-cohort-link"
          className="inline-flex items-center gap-2 text-xs font-medium text-charcoal/70 hover:text-charcoal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 rounded px-1.5 py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to patient cohort</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/supervisor/patient/${activePatient.id}/summaries`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-grey text-charcoal hover:bg-charcoal/10 rounded text-xs font-medium border border-charcoal/15 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-teal" />
            <span>Session summaries</span>
          </Link>
          <Link
            to={`/supervisor/patient/${activePatient.id}/trends`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-grey text-charcoal hover:bg-charcoal/10 rounded text-xs font-medium border border-charcoal/15 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5 text-slate-teal" />
            <span>Trajectory trends</span>
          </Link>
          <Link
            to={`/supervisor/patient/${activePatient.id}/messages`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-charcoal text-bone hover:bg-charcoal/90 rounded text-xs font-medium transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Direct messages</span>
          </Link>
        </div>
      </div>

      {/* Patient Continuity Header Card */}
      <header
        id={`patient-header-${activePatient.id}`}
        className="bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
                {activePatient.name}
              </h1>
              <div className="flex items-center gap-1.5">
                <RiskBadge
                  level={activePatient.currentRiskLevel}
                  trend={activePatient.distressTrend}
                  showTrendIcon={true}
                />
                <TrendBadge trend={activePatient.distressTrend} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal/70">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
                <span>Assigned supervisor: <strong className="text-charcoal font-medium">Dr. Meera Iyer</strong></span>
              </div>
              <span className="text-charcoal/30 hidden sm:inline" aria-hidden="true">·</span>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-charcoal/50" aria-hidden="true" />
                <span>Last check-in: <strong className="text-charcoal font-medium">{formattedDate}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-teal bg-slate-teal/10 px-3 py-1.5 rounded border border-slate-teal/20 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Privacy protected · High-level themes only</span>
            </span>
          </div>
        </div>
      </header>

      {/* Privacy Notice Banner */}
      <aside
        aria-label="Student Privacy Notice"
        className="p-3 bg-paper-grey/80 border border-charcoal/15 rounded-lg text-xs text-charcoal/75 flex items-start gap-2.5"
      >
        <ShieldCheck className="w-4 h-4 text-slate-teal shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong>Privacy guarantee:</strong> Student's raw conversation transcripts and private reflections remain on their personal device. You receive high-level continuity observations and distress trajectories to support timely human outreach.
        </p>
      </aside>

      {/* Two-column Layout: Longitudinal Timeline + Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Longitudinal Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <PatientLongitudinalTimeline sessions={activePatientSessions} />
        </div>

        {/* Right Column: Supervisor Action Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <SupervisorActionPanel
            patient={activePatient}
            actions={activePatientActions}
          />
        </div>
      </div>
    </div>
  );
}
