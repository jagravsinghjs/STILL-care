/**
 * STILL-care Written Reflection View
 *
 * Quiet, unhurried space for typed reflection.
 * No character counters, no minimum word counts, no robotic avatars.
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { GENTLE_PROMPTS } from './PromptSelector';

interface WrittenReflectionViewProps {
  prompt: string;
  content: string;
  onChangeContent: (content: string) => void;
  onSelectPrompt: (prompt: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function WrittenReflectionView({
  prompt,
  content,
  onChangeContent,
  onSelectPrompt,
  onSubmit,
  onBack,
  isSubmitting
}: WrittenReflectionViewProps) {
  const [showPromptPicker, setShowPromptPicker] = useState(false);

  const handleBack = () => {
    if (content.trim().length > 0) {
      const confirmLeave = window.confirm(
        'You have an active reflection. Are you sure you want to go back to the previous screen? Your text will be cleared.'
      );
      if (!confirmLeave) return;
    }
    onBack();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Guiding Prompt Header */}
      <div className="bg-paper-grey/60 border border-charcoal/10 rounded-lg p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-charcoal/60 uppercase tracking-wider">
            Guiding Prompt
          </span>
          <button
            type="button"
            onClick={() => setShowPromptPicker(!showPromptPicker)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-teal hover:text-charcoal transition-colors font-medium"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            <span>{showPromptPicker ? 'Hide options' : 'Choose another prompt'}</span>
          </button>
        </div>

        <p className="font-serif text-lg text-charcoal leading-snug">
          "{prompt}"
        </p>

        {showPromptPicker && (
          <div className="pt-2 border-t border-charcoal/10 space-y-1.5 animate-fade-in">
            <p className="text-[11px] text-charcoal/60">Select an alternative prompt:</p>
            {GENTLE_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectPrompt(p);
                  setShowPromptPicker(false);
                }}
                className={`w-full text-left text-xs p-2 rounded transition-colors ${
                  p === prompt
                    ? 'bg-paper-grey text-charcoal font-medium'
                    : 'text-charcoal/70 hover:bg-bone hover:text-charcoal'
                }`}
              >
                "{p}"
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-charcoal/60">
          Take your time. There are no right or wrong answers.
        </p>
      </div>

      {/* Primary Reflection Textarea */}
      <div className="space-y-2">
        <label
          htmlFor="reflection-textarea"
          className="sr-only"
        >
          Your written reflection
        </label>
        <textarea
          id="reflection-textarea"
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
          placeholder="Write whatever feels useful to share..."
          rows={9}
          disabled={isSubmitting}
          className="w-full p-4 rounded-lg bg-bone border border-charcoal/20 text-charcoal placeholder:text-charcoal/40 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-charcoal/30 focus:border-charcoal resize-y min-h-[220px]"
        />
      </div>

      {/* Navigation and Submission Action Controls */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <button
          type="button"
          id="back-to-mode-selection"
          onClick={handleBack}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-charcoal/20 bg-bone hover:bg-paper-grey text-charcoal text-xs font-medium transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to options</span>
        </button>

        <button
          type="button"
          id="submit-written-reflection"
          onClick={onSubmit}
          disabled={content.trim().length === 0 || isSubmitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-charcoal text-bone hover:bg-charcoal/90 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm min-h-[44px]"
        >
          {isSubmitting ? (
            <span>Recording check-in...</span>
          ) : (
            <>
              <span>Submit reflection</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* Discreet Privacy Note */}
      <div className="p-3.5 bg-paper-grey/40 border border-charcoal/10 rounded text-[11px] text-charcoal/70 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-moss shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Your supervisor receives high-level themes and relevant summaries rather than your full conversation transcript.
        </p>
      </div>
    </div>
  );
}
