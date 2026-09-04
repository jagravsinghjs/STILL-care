/**
 * STILL-care Longitudinal Timeline Visualization
 *
 * Shows non-numeric trajectory across recorded check-in sessions.
 * Y-axis uses purely semantic states:
 * - Stable
 * - Monitoring
 * - Increasing concern
 *
 * Strictly NO numerical scores, NO percentages, NO clinical ratings.
 */

import React, { useState } from 'react';
import { CheckInSession } from '../../../types';
import { RiskBadge } from '../../common/Badge';
import { GitCommit, Calendar, ArrowRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LongitudinalTimelineProps {
  sessions: CheckInSession[];
}

export function LongitudinalTimeline({ sessions }: LongitudinalTimelineProps) {
  // Chronological order (oldest to newest) for left-to-right timeline reading
  const chronologicalSessions = [...sessions].sort(
    (a, b) => new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime()
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    chronologicalSessions[chronologicalSessions.length - 1]?.id || null
  );

  const selectedSession = chronologicalSessions.find((s) => s.id === selectedSessionId) || chronologicalSessions[chronologicalSessions.length - 1];

  if (chronologicalSessions.length === 0) {
    return null;
  }

  // Map semantic levels for visual vertical positioning (0 = Stable, 1 = Monitoring, 2 = Increasing concern)
  const getLevelY = (riskLevel: 'green' | 'yellow' | 'red') => {
    switch (riskLevel) {
      case 'green':
        return 20; // Stable near top
      case 'yellow':
        return 65; // Monitoring in middle
      case 'red':
        return 110; // Increasing concern near lower line
    }
  };

  const getSemanticColor = (riskLevel: 'green' | 'yellow' | 'red') => {
    switch (riskLevel) {
      case 'green':
        return '#4C7A4A'; // moss
      case 'yellow':
        return '#B98A2E'; // amber
      case 'red':
        return '#B4452F'; // terracotta
    }
  };

  return (
    <div
      id="longitudinal-timeline-container"
      className="p-5 sm:p-6 bg-paper-grey/40 border border-charcoal/15 rounded-lg space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-slate-teal" aria-hidden="true" />
          <h2 className="font-serif text-lg text-charcoal font-medium">
            Session progression over time
          </h2>
        </div>
        <span className="text-xs text-charcoal/60 font-mono">
          {chronologicalSessions.length} sessions tracked
        </span>
      </div>

      <p className="text-xs sm:text-sm text-charcoal/80 leading-relaxed max-w-2xl font-sans">
        This trajectory illustrates the continuity of your reflections over recent weeks.
        Rather than analyzing a single day, STILL-care tracks whether fatigue and demand remain steady or show gradual shifts.
      </p>

      {/* Visual Timeline SVG Canvas */}
      <div className="relative pt-2 pb-1 bg-bone border border-charcoal/15 rounded-md p-4 overflow-x-auto">
        {/* Semantic Level Legend / Axis Labels */}
        <div className="flex items-center justify-between text-[11px] font-medium text-charcoal/70 pb-3 border-b border-charcoal/10 mb-4 px-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-risk-green inline-block" />
              <span>Stable</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-risk-amber inline-block" />
              <span>Monitoring</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-risk-red inline-block" />
              <span>Increasing concern</span>
            </span>
          </div>

          <span className="text-charcoal/50 text-[10px] hidden sm:inline">
            Non-numerical semantic state
          </span>
        </div>

        {/* Timeline Graphic */}
        <div className="min-w-[500px] h-[150px] relative">
          {/* Reference baseline guidelines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-3">
            <div className="border-b border-dashed border-charcoal/10 h-0 flex items-center">
              <span className="text-[10px] text-charcoal/40 pl-1 font-mono uppercase">Stable zone</span>
            </div>
            <div className="border-b border-dashed border-charcoal/10 h-0 flex items-center">
              <span className="text-[10px] text-charcoal/40 pl-1 font-mono uppercase">Monitoring zone</span>
            </div>
            <div className="border-b border-dashed border-charcoal/10 h-0 flex items-center">
              <span className="text-[10px] text-charcoal/40 pl-1 font-mono uppercase">Concern zone</span>
            </div>
          </div>

          {/* Connected SVG Line & Points */}
          <svg
            className="w-full h-full absolute inset-0 overflow-visible"
            viewBox="0 0 500 130"
            preserveAspectRatio="none"
          >
            {/* Connecting trajectory line */}
            <polyline
              fill="none"
              stroke="#6B7280"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.5"
              points={chronologicalSessions
                .map((s, idx) => {
                  const x = (idx / Math.max(chronologicalSessions.length - 1, 1)) * 440 + 30;
                  const y = getLevelY(s.riskLevel);
                  return `${x},${y}`;
                })
                .join(' ')}
            />

            {/* Individual Session Nodes */}
            {chronologicalSessions.map((session, idx) => {
              const x = (idx / Math.max(chronologicalSessions.length - 1, 1)) * 440 + 30;
              const y = getLevelY(session.riskLevel);
              const color = getSemanticColor(session.riskLevel);
              const isSelected = selectedSession?.id === session.id;

              return (
                <g
                  key={session.id}
                  className="cursor-pointer transition-transform hover:scale-110"
                  onClick={() => setSelectedSessionId(session.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Session on ${session.date}: ${session.riskLevel}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedSessionId(session.id);
                    }
                  }}
                >
                  {/* Highlight ring for selected node */}
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r="14"
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      opacity="0.35"
                    />
                  )}

                  {/* Core Node Circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? '8' : '6'}
                    fill={color}
                    stroke="#F9F6F0"
                    strokeWidth="2.5"
                  />

                  {/* Date label underneath */}
                  <text
                    x={x}
                    y="125"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#2C2C2C"
                    opacity={isSelected ? '1' : '0.7'}
                    fontWeight={isSelected ? '600' : '400'}
                    className="font-sans"
                  >
                    {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="text-[11px] text-charcoal/50 text-center mt-2">
          Click any session node along the timeline to inspect its high-level theme and context.
        </p>
      </div>

      {/* Selected Session Inspector Card */}
      {selectedSession && (
        <div
          id="timeline-selected-session-box"
          className="p-4 bg-bone border border-charcoal/20 rounded-md space-y-2.5 animate-fade-in"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-teal" aria-hidden="true" />
              <span className="font-serif text-sm font-medium text-charcoal">
                {new Date(selectedSession.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              <span className="text-[11px] text-charcoal/60 bg-paper-grey px-2 py-0.5 rounded border border-charcoal/10">
                {selectedSession.mode === 'voice' ? 'Voice reflection' : 'Written reflection'}
              </span>
            </div>

            <RiskBadge
              level={selectedSession.riskLevel}
              trend={selectedSession.distressTrend}
              showTrendIcon={true}
            />
          </div>

          <p className="text-xs sm:text-sm text-charcoal/85 leading-relaxed font-sans">
            "{selectedSession.summary}"
          </p>

          <div className="pt-2 border-t border-charcoal/10 flex items-center justify-between text-xs">
            <span className="text-charcoal/60">
              Observation: {selectedSession.plainLanguageReason}
            </span>

            <Link
              to={`/patient/history?session=${selectedSession.id}`}
              className="inline-flex items-center gap-1 font-medium text-charcoal hover:text-charcoal/70 transition-colors shrink-0 ml-2"
            >
              <span>View in history</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
