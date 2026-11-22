export type FieldName = 'email' | 'password' | 'consultantId';
export type FieldErrors = Partial<Record<FieldName, string>>;
export function validate(values: { email: string; password?: string; consultantId?: string }, mode: 'login' | 'register' | 'reset'): FieldErrors {
  const errors: FieldErrors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (mode !== 'reset' && !values.password) errors.password = 'Enter your password.';
  else if (mode === 'register' && (values.password?.length ?? 0) < 8) errors.password = 'Use at least 8 characters for your password.';
  if (mode === 'register' && !values.consultantId?.trim()) errors.consultantId = 'Enter the ID provided by your consultant.';
  return errors;
}
export function focusFirstError(errors: FieldErrors) {
  const field = Object.keys(errors)[0];
  if (field) document.getElementById(field)?.focus();
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
