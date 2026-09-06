/**
 * STILL-care Semantic Risk Badge
 *
 * Strictly adheres to semantic risk colors:
 * - green: #4C7A4A (stable / improving)
 * - amber/yellow: #B98A2E (monitoring / moderate concern)
 * - red: #B4452F (increasing concern / elevated distress)
 *
 * STRICT REQUIREMENT:
 * Never displays numerical clinical or distress scores (no 78/100, no 1/2/3, no percentages).
 */

import React from 'react';
import { RiskLevel, DistressTrend } from '../../types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  trend?: DistressTrend;
  showTrendIcon?: boolean;
  className?: string;
}

export function RiskBadge({
  level,
  label,
  trend,
  showTrendIcon = false,
  className = ''
}: RiskBadgeProps) {
  const styles: Record<RiskLevel, string> = {
    green: 'bg-risk-green/12 text-risk-green border-risk-green/25',
    yellow: 'bg-risk-amber/12 text-risk-amber border-risk-amber/25',
    red: 'bg-risk-red/12 text-risk-red border-risk-red/25'
  };

  // Pure semantic language, no clinical diagnosis or numbers
  const defaultLabels: Record<RiskLevel, string> = {
    green: 'Stable',
    yellow: 'Monitoring',
    red: 'Increasing concern'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border font-sans select-none ${styles[level]} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          level === 'green'
            ? 'bg-risk-green'
            : level === 'yellow'
            ? 'bg-risk-amber'
            : 'bg-risk-red'
        }`}
        aria-hidden="true"
      />
      <span>{label || defaultLabels[level]}</span>

      {showTrendIcon && trend && (
        <span
          className="inline-flex items-center text-[10px] ml-0.5 opacity-80"
          title={`Trend: ${trend}`}
          aria-label={`Distress trend is ${trend}`}
        >
          {trend === 'improving' ? (
            <ArrowDownRight className="w-3 h-3 text-risk-green" />
          ) : (
            <ArrowUpRight className="w-3 h-3 text-risk-red" />
          )}
        </span>
      )}
    </span>
  );
}

export interface TrendBadgeProps {
  trend: DistressTrend;
  className?: string;
}

export function TrendBadge({ trend, className = '' }: TrendBadgeProps) {
  const isImproving = trend === 'improving';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
        isImproving
          ? 'bg-risk-green/10 text-risk-green border-risk-green/20'
          : 'bg-risk-amber/10 text-risk-amber border-risk-amber/20'
      } ${className}`}
    >
      {isImproving ? (
        <ArrowDownRight className="w-3 h-3" />
      ) : (
        <ArrowUpRight className="w-3 h-3" />
      )}
      <span className="capitalize">{trend}</span>
    </span>
  );
}
