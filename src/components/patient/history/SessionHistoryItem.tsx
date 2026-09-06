/**
 * STILL-care Session History Item
 *
 * Displays an individual check-in session with:
 * - Date
 * - Reflection mode (Written or Spoken)
 * - Plain-language summary
 * - Semantic status badge (Stable, Monitoring, Increasing concern)
 * - Trend direction
 * - Expandable detail view clearly distinguishing private transcripts from care continuity observations
 *
 * Strictly non-diagnostic: No scores, no percentages, no clinical metrics.
 */

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  PenLine,
  Mic,
  ShieldCheck,
  Eye,
  Clock
} from 'lucide-react';
import { CheckInSession } from '../../../types';
import { RiskBadge } from '../../common/Badge';

interface SessionHistoryItemProps {
  key?: string;
  session: CheckInSession;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function SessionHistoryItem({
  session,
  isExpanded,
  onToggleExpand
}: SessionHistoryItemProps) {
  const isVoice = session.mode === 'voice';

  // Format human-friendly date
  const dateObj = new Date(session.date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <article
      id={`session-item-${session.id}`}
      className={`border rounded-lg transition-all duration-150 ${
        isExpanded
          ? 'bg-paper-grey/50 border-charcoal/30 shadow-sm ring-1 ring-charcoal/10'
          : 'bg-bone border-charcoal/15 hover:border-charcoal/30 hover:bg-paper-grey/30'
      }`}
    >
      {/* Header / Summary Row (Clickable) */}
      <button
        type="button"
        id={`session-toggle-btn-${session.id}`}
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        aria-controls={`session-details-${session.id}`}
        className="w-full text-left p-4 sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-charcoal/40 rounded-lg"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Mode icon, Date & Format tag */}
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
                isVoice
                  ? 'bg-slate-teal/15 text-slate-teal border border-slate-teal/20'
                  : 'bg-charcoal/10 text-charcoal border border-charcoal/15'
              }`}
            >
              {isVoice ? (
                <Mic className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PenLine className="w-4 h-4" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-base font-medium text-charcoal">
                  {formattedDate}
                </span>
                <span className="text-[11px] text-charcoal/60 bg-bone px-2 py-0.5 rounded border border-charcoal/10">
                  {isVoice ? 'Voice reflection' : 'Written reflection'}
                </span>
              </div>
              <p className="text-xs text-charcoal/70 line-clamp-1 mt-0.5">
                {session.summary}
              </p>
            </div>
          </div>

          {/* Right: Semantic status & expand chevron */}
          <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-charcoal/10">
            <div className="flex items-center gap-2">
              <RiskBadge
                level={session.riskLevel}
                trend={session.distressTrend}
                showTrendIcon={true}
              />
            </div>

            <span className="inline-flex items-center gap-1 text-xs text-charcoal/60 font-medium pl-1">
              <span>{isExpanded ? 'Hide' : 'View'}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded Detail View */}
      {isExpanded && (
        <div
          id={`session-details-${session.id}`}
          className="px-4 sm:px-5 pb-5 pt-2 border-t border-charcoal/10 space-y-4 animate-fade-in"
        >
          {/* Section 1: Patient's Private Reflection / Transcript */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-moss shrink-0" aria-hidden="true" />
                <span>Your private reflection</span>
              </div>
              <span className="text-[11px] text-charcoal/60">
                Only visible to you
              </span>
            </div>

            <div className="p-4 bg-bone rounded border border-charcoal/15 text-sm text-charcoal/90 leading-relaxed font-sans shadow-inner">
              {session.transcript ? (
                <p className="whitespace-pre-wrap italic">
                  "{session.transcript}"
                </p>
              ) : (
                <p className="text-xs text-charcoal/50 italic">
                  No transcript content saved for this session.
                </p>
              )}
            </div>

            <p className="text-[11px] text-charcoal/60 leading-normal">
              This reflection is saved in your personal archive. Your care supervisor does not receive your full conversation transcript.
            </p>
          </div>

          {/* Section 2: Care Continuity Observation */}
          <div className="p-3.5 bg-paper-grey/80 rounded border border-charcoal/15 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium text-charcoal">
                <Clock className="w-3.5 h-3.5 text-slate-teal shrink-0" aria-hidden="true" />
                <span>Care continuity observation</span>
              </div>
              <span className="text-[10px] text-charcoal/60 uppercase tracking-wider font-mono">
                Supervisor visibility
              </span>
            </div>

            <p className="text-charcoal/80 leading-relaxed">
              {session.plainLanguageReason}
            </p>

            <p className="text-[11px] text-charcoal/50 pt-1 border-t border-charcoal/10">
              High-level themes are shared with your assigned care supervisor to ensure continuity of care without exposing your raw words.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
