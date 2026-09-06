/**
 * STILL-care New Check-In Introduction Page
 * Route: /patient/checkin/new
 *
 * Provides a quiet, low-pressure introduction where patients choose their reflection mode:
 * - Written reflection
 * - Voice reflection (simulated demo)
 *
 * Includes gentle, optional prompts to inspire reflection without feeling like a survey.
 * Built for Indian context (SIH) with neutral, supportive tone.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, HeartHandshake } from 'lucide-react';
import { usePatientStore } from '../../store/patientStore';
import {
  ModeSelector,
  PromptSelector,
  GENTLE_PROMPTS
} from '../../components/patient/checkin';

export default function NewCheckInPage() {
  const navigate = useNavigate();
  const { setDraftMode } = usePatientStore();

  const [selectedMode, setSelectedMode] = useState<'text' | 'voice' | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string>(GENTLE_PROMPTS[0]);

  const handleModeSelect = (mode: 'text' | 'voice') => {
    setSelectedMode(mode);
    setDraftMode(mode);
  };

  const handleContinue = () => {
    if (!selectedMode) return;
    const queryParams = new URLSearchParams({
      mode: selectedMode,
      prompt: selectedPrompt
    });
    navigate(`/patient/checkin/conversation?${queryParams.toString()}`);
  };

  return (
    <div
      id="new-checkin-container"
      className="max-w-2xl mx-auto space-y-8 font-sans animate-fade-in py-2"
    >
      {/* Back Link */}
      <div>
        <Link
          id="back-to-dashboard-link"
          to="/patient/dashboard"
          className="inline-flex items-center gap-2 text-xs font-medium text-charcoal/70 hover:text-charcoal transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to dashboard</span>
        </Link>
      </div>

      {/* Primary Invitation Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-teal font-medium">
          <HeartHandshake className="w-4 h-4" aria-hidden="true" />
          <span>STILL-care Reflection</span>
        </div>
        <h1
          id="new-checkin-heading"
          className="font-serif text-3xl sm:text-4xl text-charcoal font-normal tracking-tight"
        >
          Take a moment for yourself.
        </h1>
        <p className="text-sm sm:text-base text-charcoal/75 leading-relaxed">
          A check-in is an unhurried opportunity to pause and reflect on your days. You can choose to write your thoughts or speak them aloud—whichever feels most comfortable right now.
        </p>
      </div>

      {/* Mode Selection */}
      <section aria-labelledby="choose-format-heading" className="space-y-3">
        <h2
          id="choose-format-heading"
          className="text-xs font-semibold uppercase tracking-wider text-charcoal/70"
        >
          Choose how you would like to reflect
        </h2>
        <ModeSelector
          selectedMode={selectedMode}
          onSelectMode={handleModeSelect}
        />
      </section>

      {/* Optional Low-Pressure Prompts */}
      <section aria-label="Optional prompts" className="bg-paper-grey/40 border border-charcoal/10 rounded-lg p-5">
        <PromptSelector
          selectedPrompt={selectedPrompt}
          onSelectPrompt={setSelectedPrompt}
        />
      </section>

      {/* Primary Action & Validation */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          id="continue-to-checkin-button"
          onClick={handleContinue}
          disabled={!selectedMode}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40"
        >
          <span>Continue</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>

        {!selectedMode && (
          <p className="text-center text-xs text-charcoal/60" id="mode-required-hint">
            Please choose either written or voice reflection to proceed.
          </p>
        )}
      </div>

      {/* Subtle Privacy Reassurance */}
      <div className="p-4 bg-paper-grey/30 border border-charcoal/10 rounded text-xs text-charcoal/70 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-moss shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Your reflections remain private. Your assigned supervisor receives high-level themes and relevant summaries rather than your full conversation transcript.
        </p>
      </div>
    </div>
  );
}
