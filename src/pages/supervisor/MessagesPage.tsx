/**
 * STILL-care Supervisor Direct Messages Page (/supervisor/messages and /supervisor/patient/:id/messages)
 *
 * Provides supportive asynchronous communication between supervisor (Dr. Meera Iyer) and students:
 * - Student selector list
 * - Interactive conversation history
 * - Supportive message composer with quick-insert templates
 * - Low-pressure framing ("No immediate response expected")
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Mail,
  Send,
  User,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useSupervisorStore } from '../../store/supervisorStore';
import { RiskBadge } from '../../components/common/Badge';

export default function SupervisorMessagesPage() {
  const { id } = useParams<{ id: string }>();
  const { patients, messages, activePatient, loadSupervisorData, sendSupportiveMessage } = useSupervisorStore();

  const [selectedPatientId, setSelectedPatientId] = useState<string>(id || 'pat-1');
  const [composerText, setComposerText] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  useEffect(() => {
    if (id) {
      setSelectedPatientId(id);
    }
  }, [id]);

  const currentPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  const threadMessages = messages.filter((m) => m.patientId === currentPatient?.id);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() || !currentPatient) return;

    await sendSupportiveMessage(currentPatient.id, composerText);
    setComposerText('');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const insertTemplate = (template: string) => {
    const studentFirstName = currentPatient?.name.split(' ')[0] || 'there';
    setComposerText(template.replace('{name}', studentFirstName));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/15 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
            Direct messages
          </h1>
          <p className="text-xs sm:text-sm text-charcoal/70 mt-1">
            Asynchronous check-in messaging between supervisor and students.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-charcoal/60 bg-paper-grey px-3 py-1.5 rounded border border-charcoal/10 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-teal" aria-hidden="true" />
          <span>Low-pressure asynchronous channel</span>
        </div>
      </div>

      {/* Two Column Message Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Student Caseload List (4 cols) */}
        <aside className="md:col-span-4 bg-bone border border-charcoal/15 rounded-lg p-3 space-y-2">
          <span className="text-[11px] font-semibold text-charcoal/60 uppercase tracking-wider block px-2 pt-1">
            Student conversations
          </span>

          <div className="space-y-1" role="tablist" aria-label="Select student for messaging">
            {patients.map((patient) => {
              const isSelected = patient.id === currentPatient?.id;
              return (
                <button
                  key={patient.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`w-full text-left p-2.5 rounded text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-charcoal text-bone font-medium shadow-2xs'
                      : 'hover:bg-paper-grey text-charcoal'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-serif text-sm font-semibold">{patient.name}</div>
                    <div className={`text-[11px] ${isSelected ? 'text-bone/75' : 'text-charcoal/60'}`}>
                      Last check-in: {patient.lastCheckInDate}
                    </div>
                  </div>

                  <RiskBadge level={patient.currentRiskLevel} className="scale-90" />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Message Conversation & Composer (8 cols) */}
        <div className="md:col-span-8 bg-bone border border-charcoal/15 rounded-lg p-5 sm:p-6 space-y-5">
          {/* Conversation Header */}
          {currentPatient && (
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <div>
                <h2 className="font-serif text-lg font-semibold text-charcoal">
                  {currentPatient.name}
                </h2>
                <span className="text-xs text-charcoal/60">
                  Care continuity thread · {currentPatient.currentRiskLevel === 'red' ? 'Increasing concern' : currentPatient.currentRiskLevel === 'yellow' ? 'Monitoring' : 'Stable'}
                </span>
              </div>

              <Link
                to={`/supervisor/patients/${currentPatient.id}`}
                className="text-xs font-medium text-slate-teal hover:underline flex items-center gap-1"
              >
                <span>View continuity record</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Feedback banner */}
          {feedbackSent && (
            <div className="p-2.5 bg-risk-green/15 text-risk-green border border-risk-green/30 rounded text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Supportive message delivered to student.</span>
            </div>
          )}

          {/* Messages Feed */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1" role="log" aria-label="Direct message history">
            {threadMessages.length === 0 ? (
              <div className="p-6 text-center text-xs text-charcoal/60 bg-paper-grey/50 rounded border border-charcoal/10">
                No direct messages yet with {currentPatient?.name}. Send a supportive check-in note below.
              </div>
            ) : (
              threadMessages.map((msg) => {
                const isSupervisor = msg.senderRole === 'supervisor';
                const msgTime = new Date(msg.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isSupervisor ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-charcoal/50 mb-1 px-1">
                      <span>{isSupervisor ? 'Dr. Meera Iyer (You)' : currentPatient?.name}</span>
                      <span>·</span>
                      <span>{msgTime}</span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                        isSupervisor
                          ? 'bg-charcoal text-bone rounded-tr-none'
                          : 'bg-paper-grey text-charcoal border border-charcoal/15 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick-insert Templates */}
          <div className="space-y-1.5 pt-2 border-t border-charcoal/10">
            <span className="text-[11px] font-medium text-charcoal/60 block">
              Suggested supportive phrases:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: 'Demanding days',
                  text: "Hi {name}, I noticed you've had a few demanding days recently. I wanted to check in and see how you're doing. No need to respond immediately."
                },
                {
                  label: 'Office hours open',
                  text: "Hi {name}, hope your week is treating you okay. My drop-in office hours are open on Thursday if you'd like a low-key chat."
                },
                {
                  label: 'Gentle check-in',
                  text: 'Hi {name}, just dropping a quiet note to say I am thinking of your semester pacing. Take things one day at a time.'
                }
              ].map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertTemplate(template.text)}
                  className="text-[11px] bg-paper-grey text-charcoal/80 hover:text-charcoal hover:bg-charcoal/10 border border-charcoal/15 rounded px-2.5 py-1 transition-colors"
                >
                  + {template.label}
                </button>
              ))}
            </div>
          </div>

          {/* Composer Form */}
          <form onSubmit={handleSendMessage} className="space-y-3">
            <div>
              <label htmlFor="supervisor-message-input" className="sr-only">
                Type a message to the student
              </label>
              <textarea
                id="supervisor-message-input"
                rows={3}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder={`Write a low-pressure message to ${currentPatient?.name}...`}
                className="w-full p-3 rounded bg-paper-grey/50 border border-charcoal/20 text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-charcoal/50 italic">
                Framed with gentle reassurance.
              </span>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-charcoal text-bone rounded hover:bg-charcoal/90 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 min-h-[44px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send message</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
