/**
 * STILL-care State Feedback Primitives
 *
 * LoadingState: Quiet spinner with thoughtful message (no aggressive flashy spinners).
 * EmptyState: Minimalist placeholder with human phrasing.
 * ErrorState: Grounded, non-alarmist message with retry action.
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from './Button';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = 'Loading details...',
  className = ''
}: LoadingStateProps) {
  return (
    <div
      className={`p-10 flex flex-col items-center justify-center text-center gap-3 font-sans ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      <p className="text-xs text-charcoal/70">{message}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'No records found',
  description = 'There are currently no items to display in this space.',
  actionLabel,
  onAction,
  icon,
  className = ''
}: EmptyStateProps) {
  return (
    <div
      className={`p-8 bg-paper-grey/50 border border-charcoal/10 rounded text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6 gap-3 ${className}`}
    >
      <div className="w-10 h-10 rounded bg-paper-grey flex items-center justify-center text-charcoal/50 border border-charcoal/10">
        {icon || <Inbox className="w-5 h-5 stroke-[1.5]" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-serif text-charcoal font-medium">{title}</h3>
        <p className="text-xs text-charcoal/70 max-w-sm">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Unable to load information',
  message = 'We encountered a momentary issue retrieving this data.',
  onRetry,
  className = ''
}: ErrorStateProps) {
  return (
    <div
      className={`p-6 bg-risk-amber/10 border border-risk-amber/30 rounded text-center flex flex-col items-center justify-center max-w-lg mx-auto my-6 gap-3 ${className}`}
      role="alert"
    >
      <div className="w-9 h-9 rounded bg-risk-amber/20 flex items-center justify-center text-risk-amber">
        <AlertTriangle className="w-5 h-5 stroke-[1.75]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-serif text-charcoal font-medium">{title}</h3>
        <p className="text-xs text-charcoal/80 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="mt-1"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
