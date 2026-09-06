/**
 * STILL-care Patient Supervisor Connection & Privacy Transparency Page
 * Route: /patient/supervisor
 *
 * Core Pillars:
 * 1. Assigned Supervisor Profile (Dr. Meera Iyer, Supervising Counselor)
 * 2. Privacy & Data Boundary Inspector (Explicit breakdown of What is Visible vs. What is Private)
 * 3. Care Outreach & Continuity History (Records of supervisor outreach and student touches)
 * 4. Interactive Appointment Request (Book office hours or informal check-in)
 * 5. Emergency Resources Safety Net
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  ShieldCheck,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Mail,
  ArrowRight,
  CheckCircle2,
  Lock,
  FileCheck,
  AlertCircle,
  Plus,
  Send,
  ArrowLeft
} from 'lucide-react';
import { usePatientStore } from '../../store/patientStore';
import { LoadingState } from '../../components/common/FeedbackStates';

export default function SupervisorConnectionPage() {
  const {
    currentPatient,
    supervisorActions,
    isLoading,
    loadPatientData,
    loadSupervisorActions,
    requestAppointment
  } = usePatientStore();

  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [preferredSlot, setPreferredSlot] = useState('Tuesday, 2:30 PM (Office Hours)');
  const [appointmentNote, setAppointmentNote] = useState('');
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentPatient) {
      loadPatientData('pat-1');
    } else {
      loadSupervisorActions(currentPatient.id);
    }
  }, [currentPatient, loadPatientData, loadSupervisorActions]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferredSlot || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await requestAppointment(preferredSlot, appointmentNote);
      setAppointmentSuccess(true);
      setAppointmentNote('');
      setTimeout(() => {
        setAppointmentSuccess(false);
        setIsAppointmentModalOpen(false);
      }, 2500);
    } catch (err) {
      console.error('Failed to book appointment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="supervisor-connection-page"
      className="max-w-4xl mx-auto space-y-7 font-sans animate-fade-in py-2"
    >
      {/* Wayfinding Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/patient/dashboard"
              className="text-charcoal/60 hover:text-charcoal transition-colors p-1 -ml-1 rounded focus-visible:ring-1 focus-visible:ring-charcoal"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Stethoscope className="w-5 h-5 text-slate-teal" aria-hidden="true" />
            <h1 className="font-serif text-2xl sm:text-3xl text-charcoal font-normal">
              Your care supervisor & privacy boundary
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            Learn about your assigned counselor, review exactly what information is shared, and request support.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/patient/messages"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-medium bg-charcoal text-bone hover:bg-charcoal/90 transition-colors min-h-[40px]"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Open messages</span>
          </Link>
        </div>
      </div>

      {/* Supervisor Profile Card */}
      <section
        id="supervisor-profile-card"
        aria-label="Assigned Supervisor Profile"
        className="bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-slate-teal/10 border border-slate-teal/20 flex items-center justify-center text-slate-teal font-serif font-semibold text-xl shrink-0">
              MI
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-xl sm:text-2xl font-semibold text-charcoal">
                  Dr. Meera Iyer, Ph.D.
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-teal bg-slate-teal/10 px-2.5 py-0.5 rounded border border-slate-teal/20 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Care Supervisor
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-charcoal/80">
                Supervising Counselor &middot; Counseling & Wellness Services
              </p>
              <p className="text-xs text-charcoal/65 max-w-xl leading-relaxed pt-1">
                Dr. Iyer reviews longitudinal care continuity observations to ensure members receive steady, compassionate guidance during demanding academic semesters and campus transitions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAppointmentModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-paper-grey text-charcoal hover:bg-charcoal/10 border border-charcoal/20 text-xs font-medium transition-colors shrink-0 self-start sm:self-auto"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-teal" />
            <span>Request check-in time</span>
          </button>
        </div>

        {/* Office Hours & Availability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-charcoal/10 text-xs">
          <div className="p-3 bg-paper-grey/60 border border-charcoal/10 rounded flex items-center gap-3">
            <Clock className="w-4 h-4 text-charcoal/60 shrink-0" />
            <div>
              <span className="font-medium text-charcoal block">Office Hours</span>
              <span className="text-charcoal/70">Tuesdays & Thursdays, 2:00 PM – 4:00 PM</span>
            </div>
          </div>
          <div className="p-3 bg-paper-grey/60 border border-charcoal/10 rounded flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-teal shrink-0" />
            <div>
              <span className="font-medium text-charcoal block">Asynchronous Messages</span>
              <span className="text-charcoal/70">Replies typically within 24–48 hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* Radical Transparency: Privacy & Data Boundary Inspector */}
      <section
        id="privacy-boundary-matrix"
        aria-labelledby="privacy-boundary-heading"
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-teal" />
            <h2 id="privacy-boundary-heading" className="font-serif text-lg font-semibold text-charcoal">
              Privacy by design & data boundary
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-charcoal/60 bg-paper-grey px-2 py-0.5 rounded border border-charcoal/10">
            <ShieldCheck className="w-3 h-3 text-moss" />
            Strict local isolation
          </span>
        </div>

        <p className="text-xs text-charcoal/70 leading-relaxed">
          STILL-care is engineered so that you never have to choose between getting human support and protecting your personal thoughts. Here is the exact contract between your private space and your supervisor:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: What Dr. Iyer Can See */}
          <div className="bg-bone border border-charcoal/15 rounded-lg p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-charcoal">
              <div className="w-6 h-6 rounded-full bg-slate-teal/15 flex items-center justify-center text-slate-teal">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-medium text-xs sm:text-sm uppercase tracking-wider text-charcoal/80">
                What Dr. Iyer receives (Care Continuity)
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-charcoal/75">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal shrink-0 mt-0.5" />
                <span><strong>Semantic continuity status:</strong> High-level category (Stable, Monitoring, Increasing concern).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal shrink-0 mt-0.5" />
                <span><strong>Trajectory direction:</strong> Whether recent check-ins show an improving or worsening trend.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal shrink-0 mt-0.5" />
                <span><strong>General themes:</strong> High-level tags such as "workload pressure" or "difficulty unwinding".</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal shrink-0 mt-0.5" />
                <span><strong>Check-in timestamps & mode:</strong> Date and whether you checked in by voice or text.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-teal shrink-0 mt-0.5" />
                <span><strong>Messages:</strong> Messages you intentionally send in the shared message thread.</span>
              </li>
            </ul>
          </div>

          {/* Card B: What Remains Strictly Private */}
          <div className="bg-paper-grey/70 border border-charcoal/15 rounded-lg p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-charcoal">
              <div className="w-6 h-6 rounded-full bg-charcoal/10 flex items-center justify-center text-charcoal">
                <EyeOff className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-medium text-xs sm:text-sm uppercase tracking-wider text-charcoal/80">
                What stays private to you (Always protected)
              </h3>
            </div>

            <ul className="space-y-2 text-xs text-charcoal/75">
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-charcoal/60 shrink-0 mt-0.5" />
                <span><strong>Raw voice recordings:</strong> Audio files never leave your device and are never sent to supervisors.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-charcoal/60 shrink-0 mt-0.5" />
                <span><strong>Full transcripts & reflections:</strong> Word-for-word text is completely omitted at the API layer.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-charcoal/60 shrink-0 mt-0.5" />
                <span><strong>Intimate phrasing & journals:</strong> Personal venting or specific names are never surfaced.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-charcoal/60 shrink-0 mt-0.5" />
                <span><strong>Unsubmitted drafts:</strong> Any text typed before submitting is discarded locally.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-charcoal/60 shrink-0 mt-0.5" />
                <span><strong>No diagnostic labeling:</strong> No psychiatric tags, numerical depression scores, or percentages.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Supervisor Care Outreach History */}
      <section
        id="care-outreach-history"
        aria-labelledby="care-outreach-heading"
        className="bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-slate-teal" />
            <h2 id="care-outreach-heading" className="font-serif text-base font-semibold text-charcoal">
              Supervisor continuity touches & outreach history
            </h2>
          </div>
          <span className="text-[11px] text-charcoal/60">
            {supervisorActions.length} recorded {supervisorActions.length === 1 ? 'touch' : 'touches'}
          </span>
        </div>

        {supervisorActions.length === 0 ? (
          <p className="text-xs text-charcoal/60 py-4 text-center">
            No supervisor outreach actions recorded yet.
          </p>
        ) : (
          <div className="space-y-3" role="feed" aria-label="Supervisor actions history">
            {supervisorActions.map((act) => {
              const formattedDate = new Date(act.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={act.id}
                  className="p-3.5 bg-paper-grey/50 border border-charcoal/10 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-charcoal">
                        {act.status}
                      </span>
                      <span className="text-charcoal/30 text-[10px]">&middot;</span>
                      <span className="text-[11px] text-charcoal/50">{formattedDate}</span>
                    </div>
                    {act.details && (
                      <p className="text-xs text-charcoal/70">{act.details}</p>
                    )}
                  </div>

                  <Link
                    to="/patient/messages"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-teal hover:text-slate-teal/80 shrink-0 self-start sm:self-auto"
                  >
                    <span>View in messages</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Appointment Booking Modal */}
      {isAppointmentModalOpen && (
        <div
          className="fixed inset-0 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-modal-title"
        >
          <div className="bg-bone border border-charcoal/20 rounded-lg max-w-md w-full p-5 sm:p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-teal" />
                <h3 id="appointment-modal-title" className="font-serif text-lg font-semibold text-charcoal">
                  Request check-in with Dr. Iyer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAppointmentModalOpen(false)}
                className="text-xs text-charcoal/60 hover:text-charcoal p-1"
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            {appointmentSuccess ? (
              <div className="py-8 text-center space-y-2 animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-risk-green/10 text-risk-green mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-medium text-sm text-charcoal">Check-in request sent!</h4>
                <p className="text-xs text-charcoal/70">
                  Dr. Iyer has been notified of your request for {preferredSlot}. She will confirm in messages.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookAppointment} className="space-y-4">
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  Select your preferred time slot for an informal 15-minute check-in or office hours chat.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="slot-select" className="block text-xs font-medium text-charcoal">
                    Preferred check-in slot
                  </label>
                  <select
                    id="slot-select"
                    value={preferredSlot}
                    onChange={(e) => setPreferredSlot(e.target.value)}
                    className="w-full p-2.5 bg-paper-grey/70 border border-charcoal/20 rounded text-xs text-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal"
                  >
                    <option value="Tuesday, 2:30 PM (Office Hours)">Tuesday, 2:30 PM (Office Hours)</option>
                    <option value="Tuesday, 3:30 PM (Office Hours)">Tuesday, 3:30 PM (Office Hours)</option>
                    <option value="Thursday, 2:00 PM (Office Hours)">Thursday, 2:00 PM (Office Hours)</option>
                    <option value="Thursday, 3:15 PM (Office Hours)">Thursday, 3:15 PM (Office Hours)</option>
                    <option value="Flexible / Asynchronous follow-up">Flexible / Check-in via Messages</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="slot-note" className="block text-xs font-medium text-charcoal">
                    Optional note for Dr. Iyer
                  </label>
                  <textarea
                    id="slot-note"
                    value={appointmentNote}
                    onChange={(e) => setAppointmentNote(e.target.value)}
                    rows={2}
                    placeholder="E.g., would like to discuss pacing strategies for thesis deadlines..."
                    className="w-full p-2.5 bg-bone border border-charcoal/20 rounded text-xs text-charcoal focus:outline-none focus:ring-1 focus:ring-charcoal resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-charcoal/10">
                  <button
                    type="button"
                    onClick={() => setIsAppointmentModalOpen(false)}
                    className="px-3 py-1.5 rounded text-xs text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-charcoal text-bone text-xs font-medium hover:bg-charcoal/90 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Sending...' : 'Confirm request'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Safety Disclaimers */}
      <footer className="p-4 bg-paper-grey/60 border border-charcoal/15 rounded-md text-xs text-charcoal/70 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-risk-amber shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-charcoal">Urgent Support & Care Access</p>
          <p className="leading-relaxed">
            STILL-care is designed for longitudinal care continuity and reflective check-ins, not acute emergency response. If you are feeling overwhelmed or need urgent assistance, please contact your campus health center, designated campus counseling cell, or local emergency medical services.
          </p>
        </div>
      </footer>
    </div>
  );
}
