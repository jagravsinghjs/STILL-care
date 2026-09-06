/**
 * STILL-care Privacy Reassurance
 *
 * Subtle, non-intrusive card reinforcing patient privacy and data sovereignty.
 * Avoids heavy legalese while assuring that raw transcripts and audio remain confidential.
 */

import { ShieldCheck } from 'lucide-react';

export function PrivacyNote() {
  return (
    <div
      id="patient-privacy-reassurance"
      className="p-4 bg-bone border border-charcoal/10 rounded text-xs text-charcoal/70 space-y-1.5"
    >
      <div className="flex items-center gap-1.5 font-medium text-charcoal/90">
        <ShieldCheck className="w-3.5 h-3.5 text-moss shrink-0" aria-hidden="true" />
        <span>Care team visibility</span>
      </div>
      <p className="leading-relaxed">
        Your assigned counselor receives high-level themes and care continuity observations rather than your
        full conversation transcript.
      </p>
    </div>
  );
}
