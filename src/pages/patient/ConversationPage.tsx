/**
 * STILL-care Active Check-In Reflection Page
 * Route: /patient/checkin/conversation
 *
 * Quiet, private reflection space.
 * Adapts between Written Reflection and Spoken (Voice) Simulation.
 * Explicitly NOT a chatbot or conversational AI.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { usePatientStore } from '../../store/patientStore';
import { CheckInSession } from '../../types';
import {
  WrittenReflectionView,
  VoiceReflectionView,
  CheckInConfirmationView,
  GENTLE_PROMPTS
} from '../../components/patient/checkin';

export default function ConversationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawMode = searchParams.get('mode');
  const activeMode: 'text' | 'voice' = rawMode === 'voice' ? 'voice' : 'text';

  const initialPrompt = searchParams.get('prompt') || GENTLE_PROMPTS[0];
  const [selectedPrompt, setSelectedPrompt] = useState<string>(initialPrompt);

  const { activeCheckInDraft, setDraftContent, submitCheckIn, isLoading } = usePatientStore();
  const [content, setContent] = useState<string>(activeCheckInDraft.content || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSession, setSubmittedSession] = useState<CheckInSession | null>(null);

  // Sync draft content with local state
  const handleContentChange = (newText: string) => {
    setContent(newText);
    setDraftContent(newText);
  };

  const handleWrittenSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const session = await submitCheckIn({
        mode: 'text',
        content: content.trim()
      });
      if (session) {
        setSubmittedSession(session);
      }
    } catch (error) {
      console.error('Failed to submit check-in:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceSubmit = async (transcriptText: string) => {
    if (!transcriptText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const session = await submitCheckIn({
        mode: 'voice',
        content: transcriptText.trim()
      });
      if (session) {
        setSubmittedSession(session);
      }
    } catch (error) {
      console.error('Failed to submit voice check-in:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToOptions = () => {
    navigate('/patient/checkin/new');
  };

  // If already submitted, display the calm Confirmation View
  if (submittedSession) {
    return (
      <div id="conversation-submitted-stage" className="py-4 font-sans">
        <CheckInConfirmationView session={submittedSession} />
      </div>
    );
  }

  return (
    <div
      id="conversation-container"
      className="max-w-3xl mx-auto space-y-6 font-sans animate-fade-in py-2"
    >
      {/* Top Header */}
      <div className="text-center space-y-1 pb-2">
        <h1
          id="checkin-reflection-heading"
          className="font-serif text-2xl sm:text-3xl text-charcoal font-normal"
        >
          {activeMode === 'voice' ? 'Voice reflection' : 'Written reflection'}
        </h1>
        <p className="text-xs sm:text-sm text-charcoal/70">
          A calm space to reflect on what is present for you today.
        </p>
      </div>

      {/* Mode-specific Interface */}
      {activeMode === 'text' ? (
        <WrittenReflectionView
          prompt={selectedPrompt}
          content={content}
          onChangeContent={handleContentChange}
          onSelectPrompt={setSelectedPrompt}
          onSubmit={handleWrittenSubmit}
          onBack={handleBackToOptions}
          isSubmitting={isSubmitting || isLoading}
        />
      ) : (
        <VoiceReflectionView
          prompt={selectedPrompt}
          onSubmit={handleVoiceSubmit}
          onBack={handleBackToOptions}
          isSubmitting={isSubmitting || isLoading}
        />
      )}
    </div>
  );
}
