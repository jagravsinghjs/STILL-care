/**
 * STILL-care Form Inputs: Input, Textarea, Select
 *
 * Clean, accessible form controls designed for calm readability.
 * Uses Source Serif 4 labels, sentence case, clear focus-visible outlines,
 * and high-contrast charcoal text on bone/paper-grey surfaces.
 */

import React, {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  forwardRef
} from 'react';

// ==================== INPUT ====================
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, id, className = '', disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 font-sans">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-charcoal/90">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm bg-bone border rounded text-charcoal placeholder:text-charcoal/40 transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-risk-red focus-visible:ring-2 focus-visible:ring-risk-red/30'
              : 'border-charcoal/20 focus-visible:border-charcoal focus-visible:ring-2 focus-visible:ring-charcoal/20'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs text-risk-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-charcoal/60">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ==================== TEXTAREA ====================
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, id, className = '', disabled, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 font-sans">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-medium text-charcoal/90">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm bg-bone border rounded text-charcoal placeholder:text-charcoal/40 transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-y ${
            error
              ? 'border-risk-red focus-visible:ring-2 focus-visible:ring-risk-red/30'
              : 'border-charcoal/20 focus-visible:border-charcoal focus-visible:ring-2 focus-visible:ring-charcoal/20'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs text-risk-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-charcoal/60">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ==================== SELECT ====================
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, id, options = [], children, className = '', disabled, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 font-sans">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-charcoal/90">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm bg-bone border rounded text-charcoal transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            error
              ? 'border-risk-red focus-visible:ring-2 focus-visible:ring-risk-red/30'
              : 'border-charcoal/20 focus-visible:border-charcoal focus-visible:ring-2 focus-visible:ring-charcoal/20'
          } ${className}`}
          {...props}
        >
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error ? (
          <p className="text-xs text-risk-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-charcoal/60">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';
