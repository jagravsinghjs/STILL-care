/**
 * STILL-care Patient Dashboard Page
 *
 * An editorial, human-centered student wellbeing home.
 * Atmosphere: Calm, supportive, spacious, warm natural environment with soft botanical accents.
 *
 * Layout Structure:
 * 1. Hero: "Good morning, Ananya." with warm supportive phrasing & organic ambient backdrop.
 * 2. Main Check-in Card: Prominent, beautifully framed check-in initiation with calming illustration & depth.
 * 3. Next Suggested Check-in bar.
 * 4. Compact 4-Card Navigation Grid with distinctive soft-pastel icon badges:
 *    - My History (Soft Sage #DCE8DC)
 *    - My Insights (Muted Lavender #E8E3F2)
 *    - Messages (Soft Peach #F4D8C5)
 *    - My Supervisor (Soft Blue #DDEAF0)
 * 5. Recent Session Summary & Longitudinal Continuity Context (non-diagnostic).
 * 6. Gentle Daily Reflection / Grounding reminder.
 * 7. Supervisor connection card & Privacy transparency reassurance.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  ArrowRight,
  History,
  Mail,
  Stethoscope,
  Heart,
  Calendar,
  Clock,
  ShieldCheck,
  Feather,
  Compass,
  CheckCircle2,
  Smile
} from 'lucide-react';
import { Patient, CheckInSession, Supervisor } from '../../types';
import {
  getCurrentPatient,
  getPatientSessions,
  getAssignedSupervisor
} from '../../api/patientApi';
import { usePatientStore } from '../../store/patientStore';
import { LoadingState, ErrorState } from '../../components/common/FeedbackStates';
import {
  RecentSessionCard,
  LongitudinalContextCard,
  RecentSessionsList,
  SupervisorEntryCard,
  PrivacyNote
} from '../../components/patient';

export default function PatientDashboardPage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<CheckInSession[]>([]);
  const [supervisor, setSupervisor] = useState<Supervisor | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { loadPatientData } = usePatientStore();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const patientData = await getCurrentPatient('pat-1');
      const sessionsData = await getPatientSessions('pat-1');

      setPatient(patientData);
      setSessions(sessionsData);

      if (patientData.assignedSupervisorId) {
        const supData = await getAssignedSupervisor(patientData.assignedSupervisorId);
        setSupervisor(supData);
      }

      loadPatientData('pat-1');
    } catch (err) {
      console.error('Failed to load patient dashboard:', err);
      setError('Unable to load your check-in records. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadPatientData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <LoadingState message="Preparing your personal space..." />
      </div>
    );
  }

  // Error state
  if (error || !patient) {
    return (
      <div className="py-12">
        <ErrorState
          title="Could not open your space"
          message={error || 'We had trouble loading your information.'}
          onRetry={loadData}
        />
      </div>
    );
  }

  const firstName = patient.name ? patient.name.split(' ')[0] : 'Ananya';
  const recentSession = sessions.length > 0 ? sessions[0] : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div
      id="patient-dashboard-container"
      className="space-y-8 max-w-5xl mx-auto font-sans animate-fade-in relative"
    >
      {/* Editorial Hero Banner with Soft Botanical Shape Background */}
      <section
        id="dashboard-hero"
        className="relative overflow-hidden rounded-3xl bg-white border border-border-subtle p-6 sm:p-8 shadow-xs"
      >
        {/* Subtle decorative botanical ambient shapes */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-radial-glow pointer-events-none opacity-90 rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-organic-blob pointer-events-none opacity-60 rounded-full" />

        <div className="relative z-10 max-w-2xl space-y-2">
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-charcoal tracking-tight">
            {getGreeting()}, {firstName}.
          </h1>

          <p className="text-sm sm:text-base text-charcoal-muted leading-relaxed max-w-xl">
            Take a moment for yourself. A calmer, brighter tomorrow is always possible.
          </p>
        </div>

        {/* Main Check-In Card */}
        <div
          id="primary-checkin-banner"
          className="relative z-10 mt-6 rounded-2xl bg-paper-grey/70 border border-border-subtle p-5 sm:p-6 transition-all hover:border-forest/30 hover:bg-paper-grey/90"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              {/* Calming Botanical Icon badge */}
              <div className="w-12 h-12 rounded-2xl bg-forest text-bone flex items-center justify-center shrink-0 shadow-xs">
                <Feather className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-secondary-green font-medium">
                  <span>Personal check-in</span>
                  <span className="text-charcoal-muted">&middot;</span>
                  <span className="text-charcoal-muted">5–10 minutes</span>
                </div>
                <h2 className="font-serif text-lg sm:text-xl font-semibold text-charcoal">
                  Ready to take a few quiet minutes?
                </h2>
                <p className="text-xs sm:text-sm text-charcoal-muted max-w-xl leading-relaxed">
                  You can speak aloud or write at your own pace.
                  Your reflections remain encrypted and strictly on your device.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              <Link
                id="start-checkin-primary-cta"
                to="/patient/checkin/new"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-forest hover:bg-forest/90 text-bone text-sm font-medium transition-all shadow-xs hover:scale-[1.02] cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 stroke-[2]" />
                <span>Start a check-in</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Next Suggested Check-in Timing Sub-bar */}
          <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal-muted">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-secondary-green" />
              <span>Next suggested check-in: <strong>Today &middot; Evening reflection window</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-charcoal-muted/70">Last check-in:</span>
              <span className="font-medium text-charcoal">{patient.lastCheckInDate}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Compact 4-Card Navigation & Action Grid with Soft Pastel Badges */}
      <section aria-label="Quick Actions" className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: My History (Soft Sage) */}
        <Link
          to="/patient/history"
          className="bg-white hover:bg-paper-grey/40 border border-border-subtle rounded-2xl p-4 transition-all hover:border-forest/30 shadow-xs flex flex-col justify-between group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#DCE8DC] text-[#24533F] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-sm font-semibold text-charcoal block group-hover:text-forest transition-colors">
              My History
            </span>
            <span className="text-[11px] text-charcoal-muted block pt-0.5">
              {sessions.length} check-in entries
            </span>
          </div>
        </Link>

        {/* Card 2: My Insights (Muted Lavender) */}
        <Link
          to="/patient/reports"
          className="bg-white hover:bg-paper-grey/40 border border-border-subtle rounded-2xl p-4 transition-all hover:border-forest/30 shadow-xs flex flex-col justify-between group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E8E3F2] text-[#5D4A82] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-sm font-semibold text-charcoal block group-hover:text-forest transition-colors">
              My Insights
            </span>
            <span className="text-[11px] text-charcoal-muted block pt-0.5">
              Reflections & reports
            </span>
          </div>
        </Link>

        {/* Card 3: Messages (Soft Peach) */}
        <Link
          to="/patient/messages"
          className="bg-white hover:bg-paper-grey/40 border border-border-subtle rounded-2xl p-4 transition-all hover:border-forest/30 shadow-xs flex flex-col justify-between group relative"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F4D8C5] text-[#9E532B] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-sm font-semibold text-charcoal block group-hover:text-forest transition-colors">
              Messages
            </span>
            <span className="text-[11px] text-charcoal-muted block pt-0.5">
              Dr. Meera Iyer
            </span>
          </div>
          <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-forest" title="Unread note" />
        </Link>

        {/* Card 4: My Counselor & Privacy (Soft Blue) */}
        <Link
          to="/patient/supervisor"
          className="bg-white hover:bg-paper-grey/40 border border-border-subtle rounded-2xl p-4 transition-all hover:border-forest/30 shadow-xs flex flex-col justify-between group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#DDEAF0] text-[#2B5B75] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <span className="font-serif text-sm font-semibold text-charcoal block group-hover:text-forest transition-colors">
              My Counselor
            </span>
            <span className="text-[11px] text-charcoal-muted block pt-0.5">
              Care & privacy rules
            </span>
          </div>
        </Link>
      </section>

      {/* Main Grid: Clinical Continuity & Reflections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (8 cols): Recent Session & Longitudinal Trend */}
        <div className="lg:col-span-8 space-y-6">
          {/* Most Recent Session */}
          <RecentSessionCard session={recentSession} />

          {/* Longitudinal Context (Non-diagnostic timeline & emotional trajectories) */}
          <LongitudinalContextCard sessions={sessions} />

          {/* Recent Check-in History Snapshot */}
          <RecentSessionsList sessions={sessions} limit={3} />
        </div>

        {/* Right Column (4 cols): Gentle Daily Reminder + Supervisor Entry + Privacy Assurance */}
        <div className="lg:col-span-4 space-y-6">
          {/* Gentle Reminder / Grounding Card */}
          <div className="bg-white border border-border-subtle rounded-2xl p-5 shadow-xs space-y-3 relative overflow-hidden">
            <div className="w-1.5 h-full bg-secondary-green absolute left-0 top-0" />
            <div className="flex items-center gap-2 text-xs font-semibold text-forest pl-1">
              <Smile className="w-4 h-4 text-secondary-green" />
              <span>Gentle reminder</span>
            </div>
            <p className="text-xs text-charcoal-muted leading-relaxed pl-1">
              "Small pauses are not time lost; they are clarity restored. Allow yourself permission to rest amidst college deadlines."
            </p>
            <div className="pt-1 pl-1 flex items-center gap-2 text-[11px] text-charcoal-muted/70">
              <CheckCircle2 className="w-3.5 h-3.5 text-secondary-green" />
              <span>Daily grounding reminder</span>
            </div>
          </div>

          {/* Supervisor Card */}
          <SupervisorEntryCard supervisor={supervisor} />

          {/* Privacy Note */}
          <PrivacyNote />
        </div>
      </div>
    </div>
  );
}
