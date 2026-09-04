/**
 * STILL-care Button Component
 *
 * Grounded, human, accessible button primitive adhering to STILL-care color tokens.
 * No neon gradients, no excessive rounded pills (unless specified), no distracting bounce animations.
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'moss';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Exact sizing with 2x horizontal padding rule
    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 rounded min-h-[32px]',
      md: 'text-sm px-4 py-2 gap-2 rounded min-h-[40px]',
      lg: 'text-base px-5 py-2.5 gap-2.5 rounded min-h-[44px]'
    };

    // STILL-care authentic color tokens (no neon/AI gradients)
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-charcoal text-bone hover:bg-charcoal/90 active:bg-charcoal focus-visible:ring-2 focus-visible:ring-charcoal/30 border border-charcoal/20',
      secondary:
        'bg-paper-grey text-charcoal hover:bg-charcoal/10 active:bg-paper-grey border border-charcoal/15 focus-visible:ring-2 focus-visible:ring-charcoal/20',
      ghost:
        'bg-transparent text-charcoal/80 hover:text-charcoal hover:bg-charcoal/5 active:bg-charcoal/10 focus-visible:ring-2 focus-visible:ring-charcoal/20',
      danger:
        'bg-risk-red text-bone hover:bg-risk-red/90 active:bg-risk-red focus-visible:ring-2 focus-visible:ring-risk-red/30 border border-risk-red/40',
      moss:
        'bg-moss text-bone hover:bg-moss/90 active:bg-moss focus-visible:ring-2 focus-visible:ring-moss/30 border border-moss/30'
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-medium font-sans transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none outline-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
