/**
 * STILL-care Supervisor Dashboard (/supervisor/dashboard)
 *
 * Core supervisor workspace built around the three foundational questions:
 * 1. "Who needs attention?" (Prioritizes Increasing concern and Monitoring)
 * 2. "What has been changing over time?" (Recent check-in continuity and distress trajectories)
 * 3. "What can I do next?" (Actionable alerts, supportive reach-out shortcuts, and recommendations)
 *
 * Avoids cluttered charts and clinical scoring. Remains focused on care continuity.
 */

import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Bell,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { PatientContinuityCard } from '../../components/supervisor/PatientContinuityCard';
import { AlertCard } from '../../components/supervisor/AlertCard';
import {
  LoadingState,
  EmptyState,
  ErrorState
} from '../../components/common/FeedbackStates';

export default function SupervisorDashboardPage() {
  const {
    patients,
    alerts,
    recommendations,
    isLoading,
    error,
    loadSupervisorData,
    markAlertReviewed
  } = useSupervisorStore();

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  // Priority filter: Patients in Increasing concern (red) or Monitoring (yellow)
  const patientsNeedingAttention = useMemo(
    () => patients.filter((p) => p.currentRiskLevel === 'red' || p.currentRiskLevel === 'yellow'),
    [patients]
  );

  const unreviewedAlerts = useMemo(
    () => alerts.filter((a) => !a.isRead),
    [alerts]
  );

  const pendingRecommendations = useMemo(
    () => recommendations.filter((r) => r.status === 'pending'),
    [recommendations]
  );

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/15 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl sm:text-2xl font-semibold text-charcoal tracking-tight">
              Continuity overview
            </span>
            <span className="text-xs bg-slate-teal/15 text-slate-teal border border-slate-teal/20 px-2 py-0.5 rounded font-medium">
              Caseload active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            Welcome, Dr. Meera Iyer. Review prioritized students, recent longitudinal trajectory changes, and continuity actions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/supervisor/patients"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Full student cohort</span>
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && patients.length === 0 && (
        <LoadingState message="Loading supervisor continuity workspace..." />
      )}

      {/* Error State */}
      {error && patients.length === 0 && (
        <ErrorState
          title="Could not load workspace"
          message={error}
          onRetry={loadSupervisorData}
        />
      )}

      {/* Main Dashboard Content */}
      {(!isLoading || patients.length > 0) && !error && (
        <>
          {/* Key Continuity Metrics */}
          <section aria-label="Caseload continuity metrics">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-bone border border-charcoal/15 rounded-lg p-4 space-y-1 shadow-2xs">
                <span className="text-xs text-charcoal/65 font-medium flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
                  <span>Assigned students</span>
                </span>
                <p className="font-serif text-2xl font-semibold text-charcoal">
                  {patients.length}
                </p>
                <span className="text-[11px] text-charcoal/50 block">All active campus records</span>
              </div>

              <div className="bg-bone border border-risk-amber/30 rounded-lg p-4 space-y-1 shadow-2xs">
                <span className="text-xs text-risk-amber font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Needs attention</span>
                </span>
                <p className="font-serif text-2xl font-semibold text-charcoal">
                  {patientsNeedingAttention.length}
                </p>
                <span className="text-[11px] text-charcoal/50 block">Monitoring or Increasing concern</span>
              </div>

              <div className="bg-bone border border-risk-red/30 rounded-lg p-4 space-y-1 shadow-2xs">
                <span className="text-xs text-risk-red font-medium flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Open alerts</span>
                </span>
                <p className="font-serif text-2xl font-semibold text-charcoal">
                  {unreviewedAlerts.length}
                </p>
                <span className="text-[11px] text-charcoal/50 block">Trajectory pattern alerts</span>
              </div>

              <div className="bg-bone border border-charcoal/15 rounded-lg p-4 space-y-1 shadow-2xs">
                <span className="text-xs text-slate-teal font-medium flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Pending actions</span>
                </span>
                <p className="font-serif text-2xl font-semibold text-charcoal">
                  {pendingRecommendations.length}
                </p>
                <span className="text-[11px] text-charcoal/50 block">Care continuity recommendations</span>
              </div>
            </div>
          </section>

          {/* QUESTION 1: "Who needs attention?" */}
          <section className="space-y-4" aria-labelledby="heading-needs-attention">
            <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
              <div>
                <h2 id="heading-needs-attention" className="font-serif text-lg font-semibold text-charcoal">
                  Who needs attention?
                </h2>
                <p className="text-xs text-charcoal/65">
                  Students currently in Increasing concern or Monitoring states, prioritized by latest check-in date.
                </p>
              </div>

              <Link
                to="/supervisor/patients"
                className="text-xs font-medium text-slate-teal hover:underline inline-flex items-center gap-1"
              >
                <span>View all ({patients.length})</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {patientsNeedingAttention.length === 0 ? (
              <div className="p-6 bg-bone border border-charcoal/15 rounded-lg text-center text-xs text-charcoal/70">
                <CheckCircle2 className="w-5 h-5 text-risk-green mx-auto mb-1.5" />
                <p className="font-medium">No students currently require escalated attention.</p>
                <p className="text-charcoal/50 mt-0.5">All assigned students are currently in a Stable trajectory.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientsNeedingAttention.map((patient) => (
                  <PatientContinuityCard key={patient.id} patient={patient} />
                ))}
              </div>
            )}
          </section>

          {/* QUESTION 2: "What has been changing over time?" & QUESTION 3: "What can I do next?" */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Recent Alerts (6 cols) */}
            <section className="lg:col-span-6 space-y-4" aria-labelledby="heading-open-alerts">
              <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
                <div>
                  <h2 id="heading-open-alerts" className="font-serif text-base font-semibold text-charcoal">
                    Multi-session pattern alerts
                  </h2>
                  <p className="text-xs text-charcoal/65">
                    Pattern changes indicating consecutive distress.
                  </p>
                </div>

                <Link
                  to="/supervisor/alerts"
                  className="text-xs font-medium text-slate-teal hover:underline inline-flex items-center gap-1"
                >
                  <span>All alerts</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {unreviewedAlerts.length === 0 ? (
                <div className="p-5 bg-bone border border-charcoal/15 rounded-lg text-center text-xs text-charcoal/60">
                  All continuity alerts have been reviewed.
                </div>
              ) : (
                <div className="space-y-3">
                  {unreviewedAlerts.slice(0, 2).map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onMarkReviewed={markAlertReviewed}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Care Continuity Actions & Recommendations (6 cols) */}
            <section className="lg:col-span-6 space-y-4" aria-labelledby="heading-pending-actions">
              <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
                <div>
                  <h2 id="heading-pending-actions" className="font-serif text-base font-semibold text-charcoal">
                    Suggested continuity actions
                  </h2>
                  <p className="text-xs text-charcoal/65">
                    Care support suggestions to maintain continuity.
                  </p>
                </div>

                <Link
                  to="/supervisor/recommendations"
                  className="text-xs font-medium text-slate-teal hover:underline inline-flex items-center gap-1"
                >
                  <span>All recommendations</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {pendingRecommendations.length === 0 ? (
                <div className="p-5 bg-bone border border-charcoal/15 rounded-lg text-center text-xs text-charcoal/60">
                  No pending recommendations.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRecommendations.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 bg-bone border border-charcoal/15 rounded-lg space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif font-semibold text-charcoal text-sm">
                          {rec.patientName}
                        </span>
                        <Link
                          to={`/supervisor/patients/${rec.patientId}`}
                          className="text-[11px] font-medium text-slate-teal hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                      <p className="text-charcoal/80 font-medium bg-paper-grey p-2 rounded border border-charcoal/10">
                        {rec.suggestedAction}
                      </p>
                      <p className="text-[11px] text-charcoal/60">
                        {rec.contextReason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
