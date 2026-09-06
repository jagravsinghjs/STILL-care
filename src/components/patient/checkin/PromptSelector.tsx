/**
 * STILL-care Prompt Selector Component
 *
 * Provides gentle, optional prompts to spark reflection.
 * Explicitly designed to avoid appearing like a clinical test or numbered survey.
 */

import React from 'react';

export const GENTLE_PROMPTS = [
  'What has been on your mind lately?',
  'How has the past few days felt for you?',
  'Is there anything that has been taking more energy than usual?'
];

interface PromptSelectorProps {
  selectedPrompt: string;
  onSelectPrompt: (prompt: string) => void;
}

export function PromptSelector({
  selectedPrompt,
  onSelectPrompt
}: PromptSelectorProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-charcoal/70">
        <span id="optional-prompts-heading">Optional prompts to help you begin</span>
      </div>
      <p className="text-xs text-charcoal/60 leading-relaxed">
        You are welcome to choose any prompt below to guide your reflection, or simply share whatever is on your mind.
      </p>

      <div
        role="group"
        aria-labelledby="optional-prompts-heading"
        className="space-y-2"
      >
        {GENTLE_PROMPTS.map((promptText, index) => {
          const isSelected = selectedPrompt === promptText;
          return (
            <button
              key={index}
              type="button"
              id={`prompt-option-${index}`}
              onClick={() => onSelectPrompt(promptText)}
              className={`w-full text-left px-4 py-3 rounded border text-xs transition-all ${
                isSelected
                  ? 'bg-paper-grey border-charcoal/40 text-charcoal font-medium ring-1 ring-charcoal/10'
                  : 'bg-bone/80 border-charcoal/10 text-charcoal/80 hover:bg-paper-grey/50 hover:border-charcoal/20'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 min-h-[44px]`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="italic">"{promptText}"</span>
                {isSelected && (
                  <span className="text-[10px] text-charcoal/60 uppercase tracking-wider font-semibold shrink-0">
                    Selected
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
