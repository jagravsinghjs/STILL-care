/**
 * STILL-care Patient Messages Page (/patient/messages)
 *
 * Dedicated asynchronous communication thread between student and assigned supervisor (Dr. Meera Iyer).
 *
 * Core Ethical & Design Principles:
 * - Low-pressure framing: Asynchronous communication with clear non-urgency expectations.
 * - Compassionate assistance: Low-energy quick reply prompts for stressed students.
 * - Clear boundaries: Crisis disclaimers reminding students that asynchronous messaging is not an emergency hotline.
 * - Real-time synchronization: Messages sent here are stored in the shared mock database and immediately visible in the supervisor portal.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  Send,
  Stethoscope,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { usePatientStore } from '../../store/patientStore';
import { LoadingState } from '../../components/common/FeedbackStates';

const QUICK_REPLY_PROMPTS = [
  'Thank you Dr. Chen, I appreciate you checking in on me.',
  'Things are still busy, but taking it one step at a time today.',
  'Feeling a bit more centered after getting some rest this weekend.',
  'Could we schedule a quick 15-minute check-in during office hours?'
];

export default function PatientMessagesPage() {
  const {
    currentPatient,
    messages,
    isLoading,
    loadPatientData,
    loadMessages,
    sendMessageToSupervisor
  } = usePatientStore();

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentPatient) {
      loadPatientData('pat-1');
    } else {
      loadMessages(currentPatient.id);
    }
  }, [currentPatient, loadPatientData, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessageToSupervisor(messageInput);
      setMessageInput('');
      setJustSent(true);
      setTimeout(() => setJustSent(false), 3000);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const patientMessages = messages.filter(
    (m) => m.patientId === (currentPatient?.id || 'pat-1')
  );

  return (
    <div
      id="patient-messages-page"
      className="max-w-4xl mx-auto space-y-6 font-sans animate-fade-in py-2"
    >
      {/* Wayfinding Top Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/patient/dashboard"
              className="text-charcoal/60 hover:text-charcoal transition-colors p-1 -ml-1 rounded focus-visible:ring-1 focus-visible:ring-charcoal"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Mail className="w-5 h-5 text-slate-teal" aria-hidden="true" />
            <h1 className="font-serif text-2xl sm:text-3xl text-charcoal font-normal">
              Direct messages with supervisor
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/70">
            A private, asynchronous channel to stay in touch with your assigned counselor, Dr. Meera Iyer.
          </p>
        </div>

        <Link
          to="/patient/supervisor"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-bone border border-charcoal/20 text-charcoal hover:bg-paper-grey/60 transition-colors shrink-0"
        >
          <Stethoscope className="w-3.5 h-3.5 text-slate-teal" />
          <span className="hidden sm:inline">Counselor info & privacy</span>
          <span className="sm:hidden">Counselor</span>
        </Link>
      </div>

      {/* Supervisor Overview Header Banner */}
      <header className="bg-bone border border-charcoal/15 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-teal/10 border border-slate-teal/20 flex items-center justify-center text-slate-teal font-serif font-semibold text-base">
              MI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-sm sm:text-base text-charcoal">
                  Dr. Meera Iyer
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-teal bg-slate-teal/10 px-2 py-0.5 rounded border border-slate-teal/20 font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  Verified supervisor
                </span>
              </div>
              <p className="text-xs text-charcoal/70">
                Supervising Counselor &middot; Community Health & Student Support Services
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-charcoal/60 bg-paper-grey/80 px-3 py-1.5 rounded border border-charcoal/10 self-start sm:self-center">
            <Clock className="w-3.5 h-3.5 text-charcoal/50" />
            <span>Asynchronous check-in thread &middot; Replies within 24–48h</span>
          </div>
        </div>

        <p className="text-xs text-charcoal/65 leading-relaxed pt-1 border-t border-charcoal/10">
          This thread allows you and Dr. Chen to exchange calm, asynchronous messages. Your supervisor receives high-level continuity updates from your check-ins, but never your private voice recordings or raw transcripts.
        </p>
      </header>

      {/* Message History Feed */}
      <div
        className="bg-bone border border-charcoal/15 rounded-lg p-4 sm:p-6 min-h-[380px] flex flex-col justify-between shadow-2xs"
        role="region"
        aria-label="Message conversation"
      >
        {isLoading && patientMessages.length === 0 ? (
          <div className="py-16">
            <LoadingState message="Loading your message thread..." />
          </div>
        ) : patientMessages.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-paper-grey border border-charcoal/10 flex items-center justify-center text-charcoal/50">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-base text-charcoal font-medium">No messages exchanged yet</h3>
            <p className="text-xs text-charcoal/70 max-w-md mx-auto">
              Feel free to leave a brief note, ask a question about your continuity plan, or share how your week is feeling. Dr. Chen reviews messages periodically.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6" role="log" aria-live="polite">
            {patientMessages.map((msg) => {
              const isPatient = msg.senderRole === 'patient';
              const formattedTime = new Date(msg.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-medium text-charcoal/75">
                      {isPatient ? 'You (Ananya)' : 'Dr. Meera Iyer'}
                    </span>
                    <span className="text-charcoal/30 text-[10px]">&middot;</span>
                    <span className="text-[10px] text-charcoal/50">{formattedTime}</span>
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-md rounded-lg p-3.5 text-xs sm:text-sm leading-relaxed ${
                      isPatient
                        ? 'bg-charcoal text-bone rounded-tr-xs'
                        : 'bg-paper-grey/80 border border-charcoal/15 text-charcoal rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Quick Suggestion Prompts */}
        <div className="border-t border-charcoal/10 pt-3 space-y-2">
          <div className="flex items-center gap-1 text-[11px] text-charcoal/60 font-medium">
            <Sparkles className="w-3 h-3 text-slate-teal" />
            <span>Low-effort quick replies (click to fill):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLY_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMessageInput(prompt)}
                className="text-[11px] text-left px-2.5 py-1 rounded bg-paper-grey text-charcoal/80 hover:text-charcoal hover:bg-charcoal/10 border border-charcoal/10 transition-colors"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        {/* Message Composer */}
        <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-charcoal/15 space-y-2">
          <div className="relative">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Write a message or question for Dr. Chen... (Press Cmd+Enter or Ctrl+Enter to send)"
              className="w-full p-3 text-xs sm:text-sm bg-bone border border-charcoal/20 rounded-md placeholder:text-charcoal/40 focus:outline-none focus:ring-1 focus:ring-charcoal/40 transition-shadow resize-none"
              aria-label="Message text for supervisor"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-charcoal/55">
                Press <strong>Ctrl+Enter</strong> to send
              </span>
              {justSent && (
                <span className="inline-flex items-center gap-1 text-xs text-risk-green font-medium animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Message delivered to Dr. Chen</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!messageInput.trim() || isSending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-charcoal text-bone text-xs font-medium hover:bg-charcoal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[38px] self-end sm:self-auto"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send message'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Safety & Care Boundary Disclaimer */}
      <footer className="p-4 bg-paper-grey/60 border border-charcoal/15 rounded-md text-xs text-charcoal/70 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-risk-amber shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-charcoal">
            Asynchronous support reminder
          </p>
          <p className="leading-relaxed">
            This messaging feature is asynchronous and is not monitored continuously. It should not be used during acute emergencies. If you are feeling overwhelmed or need immediate support, please reach out directly to your campus health center, student counseling cell, or local emergency services.
          </p>
        </div>
      </footer>
    </div>
  );
}
