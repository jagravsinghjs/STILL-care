import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Stethoscope } from 'lucide-react';

export function Field({ label, icon, error, trailing, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  id: string; label: string; icon: 'email' | 'password' | 'consultant'; error?: string; trailing?: ReactNode;
}) {
  const Icon = icon === 'email' ? Mail : icon === 'password' ? LockKeyhole : Stethoscope;
  return <div className="field-group">
    <label className="sr-only" htmlFor={input.id}>{label}</label>
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <Icon className="field-icon" size={23} strokeWidth={1.8} aria-hidden="true" />
      <input {...input} aria-invalid={Boolean(error)} aria-describedby={[input['aria-describedby'], error ? `${input.id}-error` : ''].filter(Boolean).join(' ') || undefined} />
      {trailing}
    </div>
    {error && <p className="field-error" id={`${input.id}-error`}>{error}</p>}
  </div>;
}

export function PasswordField({ error, value, onChange, registering, disabled }: {
  error?: string; value: string; onChange: InputHTMLAttributes<HTMLInputElement>['onChange']; registering?: boolean; disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <Field id="password" name="password" label="Password" icon="password" type={visible ? 'text' : 'password'}
    placeholder="Password" value={value} onChange={onChange} error={error} required disabled={disabled}
    autoComplete={registering ? 'new-password' : 'current-password'}
    trailing={<button className="icon-button password-toggle" type="button" aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={disabled}>
      {visible ? <Eye size={22} aria-hidden="true" /> : <EyeOff size={22} aria-hidden="true" />}
    </button>} />;
}

export function Button({ children, loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <button {...props} className={`button button--primary ${props.className ?? ''}`} disabled={props.disabled || loading} aria-busy={loading}>
    {loading && <LoaderCircle className="spinner" size={20} aria-hidden="true" />}{children}
  </button>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`notice${error ? ' notice--error' : ''}`} role={error ? 'alert' : 'status'}>
    <CircleAlert size={18} aria-hidden="true" /><p>{children}</p>
  </div>;
}
