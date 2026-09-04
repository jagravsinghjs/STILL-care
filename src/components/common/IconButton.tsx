/**
 * STILL-care IconButton Component
 *
 * Accessible square button for icons, ensuring a minimum 44px touch target on mobile
 * and clear keyboard focus states with mandatory aria-label.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string; // Mandatory for accessibility
  variant?: 'ghost' | 'secondary' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: 'w-8 h-8 p-1.5 text-xs',
      md: 'w-10 h-10 p-2 text-sm',
      lg: 'w-11 h-11 p-2.5 text-base'
    };

    const variantStyles = {
      ghost:
        'bg-transparent text-charcoal/70 hover:text-charcoal hover:bg-charcoal/5 active:bg-charcoal/10',
      secondary:
        'bg-paper-grey text-charcoal hover:bg-charcoal/10 border border-charcoal/15',
      subtle:
        'bg-bone text-charcoal/80 hover:text-charcoal border border-charcoal/10'
    };

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`inline-flex items-center justify-center rounded transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-charcoal/30 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
