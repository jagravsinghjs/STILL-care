import { useState, type FormEvent } from 'react';
import { Info, LogIn } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Field, Notice, PasswordField } from '../components/FormControls';
import { authService, destinationFor } from '../auth/service';
import { useAuth } from '../auth/AuthProvider';
import { errorMessage, focusFirstError, validate, type FieldErrors } from '../auth/validation';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consultantId, setConsultantId] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, restoring } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to={destinationFor(user.role)} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || restoring) return;
    const issues = validate({ email, password, consultantId }, 'register');
    setErrors(issues); setError('');
    if (Object.keys(issues).length) { focusFirstError(issues); return; }
    setLoading(true);
    try {
      await authService.register({ email: email.trim(), password, consultantId: consultantId.trim() });
      setPassword(''); navigate('/login', { replace: true, state: { registered: true } });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }

  return <AuthLayout title="Register" backTo="/login" variant="register">
    <div className="page-heading"><h1>Register as New User</h1><p>Create your account and link it to your consultant.</p></div>
    <div className="form-content">
      <form className="auth-form register-form" noValidate onSubmit={submit} aria-label="Register" aria-busy={loading}>
        <Field id="email" name="email" label="Email address" icon="email" type="email" placeholder="Gmail / Email" required
          autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" value={email} disabled={loading || restoring}
          onChange={(event) => { setEmail(event.target.value); setErrors((old) => ({ ...old, email: undefined })); }} error={errors.email} />
        <PasswordField registering value={password} disabled={loading || restoring}
          onChange={(event) => { setPassword(event.target.value); setErrors((old) => ({ ...old, password: undefined })); }} error={errors.password} />
        <Field id="consultantId" name="consultantId" label="Consultant ID" icon="consultant" placeholder="Consultant ID" required
          autoComplete="off" autoCapitalize="none" spellCheck={false} value={consultantId} disabled={loading || restoring}
          onChange={(event) => { setConsultantId(event.target.value); setErrors((old) => ({ ...old, consultantId: undefined })); }} error={errors.consultantId}
          aria-describedby={showInfo ? 'consultant-info' : undefined}
          trailing={<button className="icon-button" type="button" aria-label="About Consultant ID" aria-expanded={showInfo} aria-controls="consultant-info" onClick={() => setShowInfo(!showInfo)}><Info size={22} aria-hidden="true" /></button>} />
        <p id="consultant-info" className="field-help" hidden={!showInfo}>Use the ID your consultant gave you. Your account will be linked only after the service verifies that consultant and approves the connection.</p>
        {error && <Notice error>{error}</Notice>}
        <Button type="submit" loading={loading || restoring}>{restoring ? 'Checking session…' : loading ? 'Registering…' : 'Register'}</Button>
      </form>
      <div className="divider"><span>or</span></div>
      <Link className="button button--secondary existing-entry" to="/login"><LogIn size={23} aria-hidden="true" />Continue with Existing Entry</Link>
    </div>
  </AuthLayout>;
}
