import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { UserRoundPlus } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Field, Notice, PasswordField } from '../components/FormControls';
import { RoleSelector } from '../components/RoleSelector';
import { authService, destinationFor, type Role } from '../auth/service';
import { useAuth } from '../auth/AuthProvider';
import { errorMessage, focusFirstError, validate, type FieldErrors } from '../auth/validation';

export default function LoginPage() {
  const [params, setParams] = useSearchParams();
  const role: Role = params.get('role') === 'supervisor' ? 'supervisor' : 'patient';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setUser, restoring } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (user) return <Navigate to={destinationFor(user.role)} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || restoring) return;
    const issues = validate({ email, password }, 'login');
    setErrors(issues); setError('');
    if (Object.keys(issues).length) { focusFirstError(issues); return; }
    setLoading(true);
    try {
      const identity = await authService.login({ email: email.trim(), password, role });
      setPassword(''); setUser(identity); navigate(destinationFor(identity.role), { replace: true });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }

  return <AuthLayout title="Log in">
    <h1 className="sr-only">Log in to STILL-care</h1>
    <div className="form-content">
      <RoleSelector value={role} disabled={loading || restoring} onChange={(next) => { setParams({ role: next }, { replace: true }); setError(''); }} />
      {location.state?.registered === true && <Notice>Your account has been created. You can now log in.</Notice>}
      <form className="auth-form login-form" noValidate onSubmit={submit} aria-label="Log in" aria-busy={loading}>
        <Field id="email" name="email" label="Email address" icon="email" type="email" placeholder="Gmail / Email" required
          autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="email" value={email} disabled={loading || restoring}
          onChange={(event) => { setEmail(event.target.value); setErrors((old) => ({ ...old, email: undefined })); }} error={errors.email} />
        <PasswordField value={password} disabled={loading || restoring} onChange={(event) => { setPassword(event.target.value); setErrors((old) => ({ ...old, password: undefined })); }} error={errors.password} />
        <Link className="forgot-link" to={`/forgot-password?role=${role}`}>Forgot Password?</Link>
        {error && <Notice error>{error}</Notice>}
        <Button type="submit" loading={loading || restoring}>{restoring ? 'Checking session…' : loading ? 'Logging in…' : 'Log In'}</Button>
      </form>
      <div className="registration-option">
        <p>New to STILL-care?</p>
        <Link className="button button--secondary" to="/register"><UserRoundPlus size={23} aria-hidden="true" />Register as New User</Link>
      </div>
    </div>
  </AuthLayout>;
}
