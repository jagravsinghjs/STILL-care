import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Field, Notice } from '../components/FormControls';
import { authService } from '../auth/service';
import { errorMessage, focusFirstError, validate, type FieldErrors } from '../auth/validation';

export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const role = params.get('role') === 'supervisor' ? 'supervisor' : 'patient';
  const loginUrl = `/login?role=${role}`;
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const issues = validate({ email }, 'reset');
    setErrors(issues); setError('');
    if (Object.keys(issues).length) { focusFirstError(issues); return; }
    setLoading(true);
    try { await authService.forgotPassword(email.trim(), role); setSent(true); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }
  return <AuthLayout title="Reset password" backTo={loginUrl} variant="other">
    <div className="page-heading"><h1>Forgot your password?</h1><p>We’ll help you find your way back.</p></div>
    <div className="form-content">
      {sent ? <Notice>If an account matches this email and role, you’ll receive instructions to reset your password.</Notice> :
        <form className="auth-form" noValidate onSubmit={submit} aria-label="Reset password">
          <Field id="email" name="email" label="Email address" icon="email" type="email" placeholder="Gmail / Email" required autoComplete="email"
            inputMode="email" autoCapitalize="none" spellCheck={false} value={email} disabled={loading} onChange={(event) => setEmail(event.target.value)} error={errors.email} />
          {error && <Notice error>{error}</Notice>}
          <Button type="submit" loading={loading}>{loading ? 'Sending…' : 'Send Reset Link'}</Button>
        </form>}
      <Link className="text-link return-link" to={loginUrl}>Back to Log In</Link>
    </div>
  </AuthLayout>;
}
