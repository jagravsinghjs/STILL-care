/**
 * STILL-care Supervisor Action Panel
 *
 * Provides simulated care actions for the supervisor:
 * 1. Log direct reach-out (record status: Reached out to student / Student responded / Follow-up needed)
 * 2. Send supportive message (message composer with supportive pre-filled templates)
 * 3. Request appointment (simulated appointment request)
 *
 * Maintains a live local action history log for demonstration.
 */

import React, { useState } from 'react';
import {
  PhoneCall,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle
} from 'lucide-react';
import { SupervisorPatient, SupervisorActionRecord } from '../../types';
import { useSupervisorStore } from '../../store/supervisorStore';

interface SupervisorActionPanelProps {
  patient: SupervisorPatient;
  actions: SupervisorActionRecord[];
}

type ActionTab = 'reach_out' | 'supportive_message' | 'request_appointment';

export function SupervisorActionPanel({ patient, actions }: SupervisorActionPanelProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>('supportive_message');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { logAction, sendSupportiveMessage } = useSupervisorStore();

  const firstName = patient.name.split(' ')[0] || 'there';

  // Reach-out Form State
  const [reachOutStatus, setReachOutStatus] = useState<string>('Reached out to member');
  const [reachOutNote, setReachOutNote] = useState<string>('');

  // Supportive Message State
  const defaultTemplate = `Hi ${firstName}, I noticed you've had a few demanding days recently. I wanted to check in and see how you're doing. No need to respond immediately.`;
  const [messageContent, setMessageContent] = useState<string>(defaultTemplate);

  // Appointment Request State
  const [appointmentDuration, setAppointmentDuration] = useState<string>('20-minute check-in');
  const [appointmentTopic, setAppointmentTopic] = useState<string>('Workload pressure & unwinding routines');

  // Trigger feedback banner with auto-hide
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
  };

  const handleLogReachOut = async (e: React.FormEvent) => {
    e.preventDefault();
    await logAction(patient.id, 'reach_out', reachOutStatus, reachOutNote || 'Direct contact attempt recorded.');
    setReachOutNote('');
    triggerSuccess(`Reach-out logged: "${reachOutStatus}"`);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    await sendSupportiveMessage(patient.id, messageContent);
    triggerSuccess(`Supportive message sent to ${patient.name}`);
  };

  const handleRequestAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    await logAction(
      patient.id,
      'appointment_request',
      'Appointment requested',
      `${appointmentDuration} proposed for "${appointmentTopic}"`
    );
    triggerSuccess(`Appointment request sent to ${patient.name}`);
  };

  return (
    <div className="bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 space-y-5 shadow-2xs">
      {/* Header */}
      <div>
        <h3 className="font-serif text-base font-semibold text-charcoal">
          Care continuity actions
        </h3>
        <p className="text-xs text-charcoal/65 mt-0.5">
          Supportive outreach and care continuity options for {patient.name}.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b border-charcoal/15 pb-2 overflow-x-auto"
        role="tablist"
        aria-label="Supervisor action categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'supportive_message'}
          onClick={() => setActiveTab('supportive_message')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[36px] whitespace-nowrap ${
            activeTab === 'supportive_message'
              ? 'bg-charcoal text-bone'
              : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Send message</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reach_out'}
          onClick={() => setActiveTab('reach_out')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[36px] whitespace-nowrap ${
            activeTab === 'reach_out'
              ? 'bg-charcoal text-bone'
              : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Log reach-out</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'request_appointment'}
          onClick={() => setActiveTab('request_appointment')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors min-h-[36px] whitespace-nowrap ${
            activeTab === 'request_appointment'
              ? 'bg-charcoal text-bone'
              : 'text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Request appointment</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="p-3 bg-risk-green/15 text-risk-green border border-risk-green/30 rounded text-xs flex items-center gap-2 animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* TAB 1: Send Supportive Message */}
      {activeTab === 'supportive_message' && (
        <form onSubmit={handleSendMessage} className="space-y-3 animate-fade-in">
          <div className="space-y-1.5">
            <label htmlFor="message-composer" className="block text-xs font-medium text-charcoal">
              Message text (asynchronous check-in)
            </label>
            <textarea
              id="message-composer"
              rows={4}
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              className="w-full p-3 rounded bg-paper-grey/50 border border-charcoal/20 text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 font-sans"
              placeholder="Write a supportive message to the member..."
              required
            />
            <p className="text-[11px] text-charcoal/60">
              Low-pressure wording helps members feel heard without placing an immediate obligation to respond.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setMessageContent(defaultTemplate)}
              className="px-3 py-2 text-xs font-medium text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5 rounded"
            >
              Reset template
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-bone rounded hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Send supportive message</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Log Direct Reach-out */}
      {activeTab === 'reach_out' && (
        <form onSubmit={handleLogReachOut} className="space-y-3.5 animate-fade-in">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-charcoal">
              Outreach status
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                'Reached out to member',
                'Member responded',
                'Follow-up needed'
              ].map((status) => (
                <button
                  type="button"
                  key={status}
                  onClick={() => setReachOutStatus(status)}
                  className={`p-2.5 rounded border text-xs text-left transition-all ${
                    reachOutStatus === status
                      ? 'border-charcoal bg-charcoal text-bone font-medium shadow-2xs'
                      : 'border-charcoal/20 bg-paper-grey/30 text-charcoal/80 hover:border-charcoal/40'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="reach-out-note" className="block text-xs font-medium text-charcoal">
              Supervisor continuity note (optional)
            </label>
            <input
              id="reach-out-note"
              type="text"
              value={reachOutNote}
              onChange={(e) => setReachOutNote(e.target.value)}
              placeholder="e.g. Spoke briefly after afternoon lecture; agreed to connect next Tuesday."
              className="w-full p-2.5 rounded bg-paper-grey/50 border border-charcoal/20 text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-bone rounded hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Log reach-out record</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Request Appointment */}
      {activeTab === 'request_appointment' && (
        <form onSubmit={handleRequestAppointment} className="space-y-3.5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="appointment-duration" className="block text-xs font-medium text-charcoal">
                Duration
              </label>
              <select
                id="appointment-duration"
                value={appointmentDuration}
                onChange={(e) => setAppointmentDuration(e.target.value)}
                className="w-full p-2.5 rounded bg-paper-grey/50 border border-charcoal/20 text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
              >
                <option value="15-minute informal chat">15-minute informal check-in</option>
                <option value="20-minute check-in">20-minute check-in</option>
                <option value="30-minute counseling slot">30-minute support session</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="appointment-topic" className="block text-xs font-medium text-charcoal">
                Continuity focus
              </label>
              <select
                id="appointment-topic"
                value={appointmentTopic}
                onChange={(e) => setAppointmentTopic(e.target.value)}
                className="w-full p-2.5 rounded bg-paper-grey/50 border border-charcoal/20 text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
              >
                <option value="Workload pressure & unwinding routines">Workload pressure & unwinding routines</option>
                <option value="General campus wellness check">General campus wellness check</option>
                <option value="Mid-semester pacing support">Mid-semester pacing support</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-paper-grey rounded border border-charcoal/10 text-xs text-charcoal/70">
            Suggesting an appointment sends a polite invitation to the member's campus app with open availability slots.
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-bone rounded hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Send appointment request</span>
            </button>
          </div>
        </form>
      )}

      {/* Action History Log */}
      {actions && actions.length > 0 && (
        <div className="border-t border-charcoal/10 pt-4 space-y-2.5">
          <span className="text-[11px] font-semibold text-charcoal/60 uppercase tracking-wider block">
            Recent supervisor actions logged:
          </span>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {actions.map((act) => {
              const actDate = new Date(act.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={act.id}
                  className="p-2.5 bg-paper-grey/70 rounded border border-charcoal/10 text-xs flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-charcoal">
                      <Clock className="w-3 h-3 text-slate-teal shrink-0" />
                      <span>{act.status}</span>
                    </div>
                    {act.details && (
                      <p className="text-charcoal/70 text-[11px] pl-4">{act.details}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-charcoal/50 whitespace-nowrap">{actDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
