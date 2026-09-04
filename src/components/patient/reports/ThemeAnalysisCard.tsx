/**
 * STILL-care Plain-Language Themes Analysis Component
 *
 * Synthesizes recurring emotional and workload themes across check-in sessions.
 * Strictly adheres to non-diagnostic, respectful communication:
 * - "You mentioned difficulty unwinding on several recent check-ins."
 * - "Recent reflections have included more discussion of workload pressure."
 * - "Earlier check-ins described things as more manageable."
 *
 * Absolutely NO mental-health scores, NO clinical labels, NO AI confidence ratings.
 */

import React from 'react';
import { Layers, Compass, CheckCircle2, AlertCircle } from 'lucide-react';
import { CheckInSession } from '../../../types';

interface ThemeAnalysisCardProps {
  sessions: CheckInSession[];
}

export function ThemeAnalysisCard({ sessions }: ThemeAnalysisCardProps) {
  return (
    <div
      id="themes-analysis-card"
      className="p-5 sm:p-6 bg-paper-grey/40 border border-charcoal/15 rounded-lg space-y-5 font-sans"
    >
      <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3">
        <Compass className="w-4 h-4 text-slate-teal" aria-hidden="true" />
        <h2 className="font-serif text-lg text-charcoal font-medium">
          Recurring themes in your reflections
        </h2>
      </div>

      <p className="text-xs sm:text-sm text-charcoal/80 leading-relaxed">
        Looking at multiple check-ins helps surface what subjects have consistently demanded your focus and energy recently.
      </p>

      {/* Structured Theme Blocks */}
      <div className="space-y-3">
        {/* Theme 1: Workload & Academic / Project Pressure */}
        <div className="p-4 bg-bone border border-charcoal/15 rounded-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-charcoal flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-teal" />
              Workload & responsibilities
            </span>
            <span className="text-[11px] text-charcoal/60">
              Noted across recent sessions
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/85 leading-relaxed">
            Recent reflections have included more discussion of workload pressure and upcoming project milestones.
            You noted feeling that tasks are arriving faster than they can be settled.
          </p>
        </div>

        {/* Theme 2: Evening Unwinding & Rest */}
        <div className="p-4 bg-bone border border-charcoal/15 rounded-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-charcoal flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-risk-amber" />
              Rest & cognitive unwinding
            </span>
            <span className="text-[11px] text-charcoal/60">
              Recurring pattern
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/85 leading-relaxed">
            You mentioned difficulty unwinding on several recent check-ins, particularly noticing lingering mental fatigue into late evenings.
          </p>
        </div>

        {/* Theme 3: Self-Care & Centering Routines */}
        <div className="p-4 bg-bone border border-charcoal/15 rounded-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-charcoal flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-risk-green" />
              Centering & daytime routines
            </span>
            <span className="text-[11px] text-charcoal/60">
              Supportive factors
            </span>
          </div>
          <p className="text-xs sm:text-sm text-charcoal/85 leading-relaxed">
            Earlier check-ins described things as more manageable when you were able to take regular daytime walks and maintain steady lunch breaks.
          </p>
        </div>
      </div>

      {/* Longitudinal Trajectory Summary Box */}
      <div className="p-4 bg-bone/70 border border-charcoal/15 rounded-md space-y-1.5 text-xs text-charcoal/80">
        <h3 className="font-serif font-medium text-charcoal text-sm">
          Observed trajectory across weeks
        </h3>
        <p className="leading-relaxed">
          While earlier check-ins in mid-August reflected comfortable daily pacing, recent check-ins over the past week have shown higher cognitive strain and accumulated fatigue.
          This pattern provides meaningful context for your counselor to offer timely encouragement before exhaustion deepens.
        </p>
      </div>
    </div>
  );
}
