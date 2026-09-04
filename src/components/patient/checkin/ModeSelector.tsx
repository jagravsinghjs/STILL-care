/**
 * STILL-care Mode Selector Component
 *
 * Allows the patient to choose between Written and Voice reflection.
 * Non-clinical, low-pressure, accessible selection.
 */

import React from 'react';
import { PenLine, Mic, Check } from 'lucide-react';

interface ModeSelectorProps {
  selectedMode: 'text' | 'voice' | null;
  onSelectMode: (mode: 'text' | 'voice') => void;
}

export function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby="mode-selection-heading"
      className="space-y-3"
    >
      <p id="mode-selection-heading" className="sr-only">
        Choose your reflection mode
      </p>

      {/* Option 1: Written Reflection */}
      <button
        type="button"
        id="mode-written-option"
        role="radio"
        aria-checked={selectedMode === 'text'}
        onClick={() => onSelectMode('text')}
        className={`w-full text-left p-5 rounded border transition-all duration-150 relative ${
          selectedMode === 'text'
            ? 'bg-paper-grey/80 border-charcoal shadow-sm ring-1 ring-charcoal/20'
            : 'bg-bone border-charcoal/15 hover:border-charcoal/30 hover:bg-paper-grey/40'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              selectedMode === 'text'
                ? 'bg-charcoal text-bone'
                : 'bg-paper-grey text-charcoal/70 border border-charcoal/10'
            }`}
          >
            <PenLine className="w-5 h-5" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-medium text-charcoal">
                Written reflection
              </span>
            </div>
            <p className="text-xs text-charcoal/75 mt-1 leading-relaxed">
              Type your thoughts at your own pace. There is no rigid format or minimum length—write as much or as little as feels comfortable, and submit whenever you are ready.
            </p>
          </div>

          <div
            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-colors ${
              selectedMode === 'text'
                ? 'border-charcoal bg-charcoal text-bone'
                : 'border-charcoal/30 bg-transparent'
            }`}
            aria-hidden="true"
          >
            {selectedMode === 'text' && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
          </div>
        </div>
      </button>

      {/* Option 2: Voice Reflection */}
      <button
        type="button"
        id="mode-voice-option"
        role="radio"
        aria-checked={selectedMode === 'voice'}
        onClick={() => onSelectMode('voice')}
        className={`w-full text-left p-5 rounded border transition-all duration-150 relative ${
          selectedMode === 'voice'
            ? 'bg-paper-grey/80 border-charcoal shadow-sm ring-1 ring-charcoal/20'
            : 'bg-bone border-charcoal/15 hover:border-charcoal/30 hover:bg-paper-grey/40'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              selectedMode === 'voice'
                ? 'bg-slate-teal text-bone'
                : 'bg-paper-grey text-charcoal/70 border border-charcoal/10'
            }`}
          >
            <Mic className="w-5 h-5" aria-hidden="true" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2">
              <span className="font-serif text-base font-medium text-charcoal">
                Voice reflection
              </span>
              <span className="text-[10px] bg-paper-grey text-charcoal/70 px-2 py-0.5 rounded border border-charcoal/15">
                Simulated demo
              </span>
            </div>
            <p className="text-xs text-charcoal/75 mt-1 leading-relaxed">
              Speak naturally in an unhurried space. You can pause, review your simulated transcript, and adjust the words before submitting.
            </p>
          </div>

          <div
            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-colors ${
              selectedMode === 'voice'
                ? 'border-charcoal bg-charcoal text-bone'
                : 'border-charcoal/30 bg-transparent'
            }`}
            aria-hidden="true"
          >
            {selectedMode === 'voice' && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
          </div>
        </div>
      </button>
    </div>
  );
}
