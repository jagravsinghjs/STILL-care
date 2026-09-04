/**
 * STILL-care Supervisor Longitudinal Trends Page
 * Route: /supervisor/patient/:id/trends
 *
 * Core Features:
 * - Semantic Trajectory Visualization: Recharts area/line chart mapping qualitative continuity
 *   states over time (Stable -> Monitoring -> Increasing concern) WITHOUT diagnostic numerical scores.
 * - Reference zones providing immediate visual orientation (Green = Stable, Amber = Monitoring, Rose = Concern).
 * - Tooltip detailing date, modality, and non-diagnostic reason.
 * - Longitudinal Theme Frequency Matrix: Recurring cognitive/emotional patterns identified across sessions.
 * - Supervisory Touchpoints & Interventions overlay: Visual correlation between supervisor actions and trajectory changes.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Calendar,
  Clock,
  Mail,
  FileText,
  Activity,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { RiskBadge, TrendBadge } from '../../components/common/Badge';
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates';
import { TrendPoint, RiskLevel } from '../../types';

// Numerical mapping purely for spatial plotting on Y axis
const RISK_TO_VALUE: Record<RiskLevel, number> = {
  green: 1,
  yellow: 2,
  red: 3
};

export default function SupervisorTrendsPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id || 'pat-1';
  const navigate = useNavigate();

  const {
    patients,
    activePatient,
    activePatientSessions,
    activePatientActions,
    isLoading,
    error,
    loadSupervisorData,
    loadPatientDetail
  } = useSupervisorStore();

  useEffect(() => {
    loadSupervisorData();
    loadPatientDetail(patientId);
  }, [patientId, loadSupervisorData, loadPatientDetail]);

  const currentPatient = activePatient || patients.find((p) => p.id === patientId);

  if (isLoading && !currentPatient) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <LoadingState message="Calculating longitudinal trajectory..." />
      </div>
    );
  }

  if (error && !currentPatient) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <ErrorState
          title="Could not load trajectory data"
          message={error}
          onRetry={() => loadPatientDetail(patientId)}
        />
      </div>
    );
  }

  // Build chart data from activePatientSessions chronologically (oldest to newest)
  const sortedSessions = [...activePatientSessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const chartData = sortedSessions.map((session) => {
    const d = new Date(session.date + 'T00:00:00');
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: formattedDate,
      rawDate: session.date,
      value: RISK_TO_VALUE[session.riskLevel],
      riskLevel: session.riskLevel,
      trend: session.distressTrend,
      summary: session.summary,
      reason: session.plainLanguageReason,
      mode: session.mode
    };
  });

  // Frequency analysis of themes
  const themeFrequency: Record<string, number> = {};
  sortedSessions.forEach((s) => {
    const text = (s.summary + ' ' + s.plainLanguageReason).toLowerCase();
    if (text.includes('workload') || text.includes('deadline') || text.includes('academic')) {
      themeFrequency['Academic & workload pressure'] = (themeFrequency['Academic & workload pressure'] || 0) + 1;
    }
    if (text.includes('fatigue') || text.includes('sleep') || text.includes('restlessness')) {
      themeFrequency['Sleep disruption & fatigue'] = (themeFrequency['Sleep disruption & fatigue'] || 0) + 1;
    }
    if (text.includes('unwinding') || text.includes('overwhelm') || text.includes('strain')) {
      themeFrequency['Difficulty unwinding / pacing'] = (themeFrequency['Difficulty unwinding / pacing'] || 0) + 1;
    }
    if (text.includes('routine') || text.includes('social') || text.includes('withdrawal')) {
      themeFrequency['Social / routine maintenance'] = (themeFrequency['Social / routine maintenance'] || 0) + 1;
    }
  });

  return (
    <div
      id="supervisor-trends-page"
      className="max-w-5xl mx-auto space-y-6 font-sans animate-fade-in py-2"
    >
      {/* Wayfinding Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/supervisor/patients/${patientId}`}
              className="text-charcoal/60 hover:text-charcoal transition-colors p-1 -ml-1 rounded focus-visible:ring-1 focus-visible:ring-charcoal"
              aria-label="Back to patient continuity view"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <TrendingUp className="w-5 h-5 text-slate-teal" aria-hidden="true" />
            <h1 className="font-serif text-2xl sm:text-3xl text-charcoal font-semibold tracking-tight">
              Longitudinal distress & continuity trajectory
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            Semantic trajectory visualization for student{' '}
            <strong className="text-charcoal font-medium">{currentPatient?.name || 'Student'}</strong>.
          </p>
        </div>

        {/* Action deep-links */}
        <div className="flex items-center gap-2">
          <Link
            to={`/supervisor/patient/${patientId}/summaries`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-paper-grey text-charcoal hover:bg-charcoal/10 border border-charcoal/15 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-teal" />
            <span>Session summaries</span>
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

      {/* Patient Header Banner with Cohort Switcher */}
      <div className="bg-bone border border-charcoal/15 rounded-lg p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-teal/10 border border-slate-teal/20 flex items-center justify-center text-slate-teal font-serif font-bold text-lg">
              {currentPatient?.name
                .split(' ')
                .map((n) => n[0])
                .join('') || 'S'}
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
                Longitudinal baseline: <strong className="text-charcoal font-medium">Stable with emerging acute strain</strong> &middot; Monitored by Dr. Meera Iyer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <label htmlFor="trend-patient-select" className="text-xs text-charcoal/60 font-medium">
              Switch student:
            </label>
            <select
              id="trend-patient-select"
              value={patientId}
              onChange={(e) => navigate(`/supervisor/patient/${e.target.value}/trends`)}
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

        {/* Plain Language Framing Disclaimer */}
        <aside
          aria-label="Clinical methodology disclaimer"
          className="p-3 bg-paper-grey/70 border border-charcoal/10 rounded flex items-start gap-2.5 text-xs text-charcoal/75"
        >
          <Info className="w-4 h-4 text-slate-teal shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            <strong>Qualitative Trajectory:</strong> This chart does not use numerical psychological diagnostics or depression scores. It maps qualitative continuity observations (Stable, Monitoring, Increasing concern) over time to help Dr. Chen identify prolonged downward slopes and timely intervention moments.
          </p>
        </aside>
      </div>

      {/* Main Recharts Visualization Card */}
      <section
        id="trajectory-chart-card"
        aria-labelledby="trajectory-chart-title"
        className="bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
          <div>
            <h2 id="trajectory-chart-title" className="font-serif text-lg font-semibold text-charcoal">
              Distress & continuity state over recent check-ins
            </h2>
            <p className="text-xs text-charcoal/60">
              Visualizing the transition from stable grounding to acute academic strain.
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-charcoal/70">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-green/80" />
              <span>Stable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-amber/80" />
              <span>Monitoring</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-risk-red/80" />
              <span>Increasing concern</span>
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="w-full h-72 sm:h-80 pt-2" role="region" aria-label="Interactive trajectory plot">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-charcoal/50">
              No check-in points available for trajectory analysis.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                {/* Semantic Continuity Threshold Lines */}
                <ReferenceLine
                  y={1.5}
                  stroke="#8DA399"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Monitoring threshold',
                    position: 'insideBottomLeft',
                    fontSize: 10,
                    fill: '#5A6E63'
                  }}
                />
                <ReferenceLine
                  y={2.5}
                  stroke="#B85C4F"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Elevated concern threshold',
                    position: 'insideBottomLeft',
                    fontSize: 10,
                    fill: '#B85C4F'
                  }}
                />

                <CartesianGrid stroke="#262624" strokeOpacity={0.08} strokeDasharray="3 3" vertical={false} />

                <XAxis
                  dataKey="date"
                  tick={{ fill: '#262624', fontSize: 11, opacity: 0.7 }}
                  axisLine={{ stroke: '#262624', strokeOpacity: 0.2 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0.6, 3.4]}
                  ticks={[1, 2, 3]}
                  tickFormatter={(val) =>
                    val === 1 ? 'Stable' : val === 2 ? 'Monitoring' : val === 3 ? 'Concern' : ''
                  }
                  tick={{ fill: '#262624', fontSize: 11, fontWeight: 500, opacity: 0.75 }}
                  axisLine={{ stroke: '#262624', strokeOpacity: 0.2 }}
                  tickLine={false}
                  width={75}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const statusLabel =
                        data.value === 1
                          ? 'Stable'
                          : data.value === 2
                          ? 'Active Monitoring'
                          : 'Increasing Concern';

                      return (
                        <div className="bg-bone border border-charcoal/25 rounded-md p-3 shadow-md max-w-xs space-y-1.5 text-xs font-sans">
                          <div className="flex items-center justify-between border-b border-charcoal/10 pb-1">
                            <span className="font-serif font-bold text-charcoal">{data.date}</span>
                            <span className="text-[10px] text-charcoal/60 capitalize">
                              {data.mode} check-in
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                data.riskLevel === 'green'
                                  ? 'bg-risk-green'
                                  : data.riskLevel === 'yellow'
                                  ? 'bg-risk-amber'
                                  : 'bg-risk-red'
                              }`}
                            />
                            <span className="font-semibold text-charcoal">{statusLabel}</span>
                            <span className="text-charcoal/40 text-[10px]">&middot;</span>
                            <span className="capitalize text-charcoal/70">{data.trend}</span>
                          </div>
                          <p className="text-[11px] text-charcoal/75 leading-relaxed pt-1">
                            {data.reason}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2E4057"
                  strokeWidth={2.5}
                  dot={{
                    r: 5,
                    fill: '#F5F1E6',
                    stroke: '#2E4057',
                    strokeWidth: 2
                  }}
                  activeDot={{
                    r: 7,
                    fill: '#2E4057',
                    stroke: '#F5F1E6',
                    strokeWidth: 2
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Qualitative Trajectory State Guide */}
        <div className="pt-4 border-t border-charcoal/10 space-y-2">
          <h3 className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
            Semantic State Interpretations (Non-Diagnostic)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 bg-paper-grey/60 border border-charcoal/10 rounded space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-charcoal">
                <span className="w-2 h-2 rounded-full bg-risk-green" />
                <span>Stable</span>
              </div>
              <p className="text-[11px] text-charcoal/70 leading-relaxed">
                Student check-ins reflect consistent daily rhythms, active coping strategies, and low perceived distress.
              </p>
            </div>
            <div className="p-2.5 bg-paper-grey/60 border border-charcoal/10 rounded space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-charcoal">
                <span className="w-2 h-2 rounded-full bg-risk-amber" />
                <span>Monitoring</span>
              </div>
              <p className="text-[11px] text-charcoal/70 leading-relaxed">
                Emerging strain or consecutive check-ins referencing deadline fatigue or difficulty unwinding.
              </p>
            </div>
            <div className="p-2.5 bg-paper-grey/60 border border-charcoal/10 rounded space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-charcoal">
                <span className="w-2 h-2 rounded-full bg-risk-red" />
                <span>Increasing Concern</span>
              </div>
              <p className="text-[11px] text-charcoal/70 leading-relaxed">
                Persistent multi-session escalation, expressed helplessness, or routine withdrawal indicating outreach.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-charcoal/50 pt-1">
            * Note: Trajectory states are qualitative continuity flags to support human counselor judgment, not psychiatric diagnoses or psychometric test scores.
          </p>
        </div>
      </section>

      {/* Two Column Grid: Theme Frequency & Supervisory Touches */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Recurring Themes Analysis */}
        <section
          id="themes-analysis-card"
          aria-labelledby="themes-analysis-title"
          className="md:col-span-6 bg-bone border border-charcoal/15 rounded-lg p-5 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-charcoal/10 pb-2">
            <Layers className="w-4 h-4 text-slate-teal" />
            <h3 id="themes-analysis-title" className="font-serif text-base font-semibold text-charcoal">
              Recurring longitudinal themes
            </h3>
          </div>

          <p className="text-xs text-charcoal/70 leading-relaxed">
            Persistent emotional and contextual themes identified across {currentPatient?.name || 'the student'}'s check-in sessions:
          </p>

          <div className="space-y-2.5">
            {Object.entries(themeFrequency).map(([theme, count]) => (
              <div
                key={theme}
                className="p-3 bg-paper-grey/60 border border-charcoal/10 rounded flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-teal" />
                  <span className="font-medium text-charcoal">{theme}</span>
                </div>
                <span className="text-[11px] font-semibold text-charcoal/70 bg-bone px-2 py-0.5 rounded border border-charcoal/10">
                  {count} {count === 1 ? 'session' : 'sessions'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Supervisor Action Timeline */}
        <section
          id="action-timeline-card"
          aria-labelledby="action-timeline-title"
          className="md:col-span-6 bg-bone border border-charcoal/15 rounded-lg p-5 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-teal" />
              <h3 id="action-timeline-title" className="font-serif text-base font-semibold text-charcoal">
                Supervisor touchpoint timeline
              </h3>
            </div>
            <Link
              to={`/supervisor/patient/${patientId}/messages`}
              className="text-xs text-slate-teal hover:text-slate-teal/80 font-medium"
            >
              Send message
            </Link>
          </div>

          <p className="text-xs text-charcoal/70 leading-relaxed">
            Interventions logged by Dr. Meera Iyer to maintain care continuity:
          </p>

          <div className="space-y-3" role="feed" aria-label="Supervisor actions timeline">
            {activePatientActions.length === 0 ? (
              <p className="text-xs text-charcoal/60 py-4 text-center">
                No supervisor actions logged yet for this student.
              </p>
            ) : (
              activePatientActions.map((act) => {
                const formattedDate = new Date(act.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div
                    key={act.id}
                    className="p-3 bg-paper-grey/50 border border-charcoal/10 rounded space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-charcoal">{act.status}</span>
                      <span className="text-[11px] text-charcoal/50">{formattedDate}</span>
                    </div>
                    {act.details && (
                      <p className="text-xs text-charcoal/70">{act.details}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
