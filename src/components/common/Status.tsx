/**
 * STILL-care StatusDot & NotificationBadge
 *
 * StatusDot: Minimal semantic indicator for status (green/yellow/red, active, online).
 * NotificationBadge: Subtle numeric/alert pill for supervisor triage cues.
 */

import React from 'react';
import { RiskLevel } from '../../types';

export interface StatusDotProps {
  status: 'online' | 'idle' | 'offline' | RiskLevel;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  className?: string;
}

export function StatusDot({
  status,
  size = 'md',
  ariaLabel,
  className = ''
}: StatusDotProps) {
  const sizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  const colorMap: Record<string, string> = {
    green: 'bg-risk-green',
    yellow: 'bg-risk-amber',
    red: 'bg-risk-red',
    online: 'bg-risk-green',
    idle: 'bg-risk-amber',
    offline: 'bg-charcoal/40'
  };

  const labelText = ariaLabel || `Status: ${status}`;

  return (
    <span
      className={`inline-block rounded-full shrink-0 ${sizeMap[size]} ${colorMap[status] || 'bg-charcoal/40'} ${className}`}
      role="status"
      aria-label={labelText}
      title={labelText}
    />
  );
}

export interface NotificationBadgeProps {
  count?: number;
  label?: string;
  variant?: 'subtle' | 'alert' | 'charcoal';
  className?: string;
}

export function NotificationBadge({
  count,
  label,
  variant = 'subtle',
  className = ''
}: NotificationBadgeProps) {
  const variantMap = {
    subtle: 'bg-charcoal/10 text-charcoal border border-charcoal/15',
    alert: 'bg-risk-red/15 text-risk-red border border-risk-red/30 font-semibold',
    charcoal: 'bg-charcoal text-bone border border-charcoal/30 font-medium'
  };

  if (count === undefined && !label) return null;
  if (count !== undefined && count <= 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center text-[11px] px-1.5 py-0.2 rounded-full min-w-[18px] h-[18px] select-none ${variantMap[variant]} ${className}`}
    >
      {label || count}
    </span>
  );
}
