import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Button, Notice } from '../components/FormControls';
import { useAuth } from '../auth/AuthProvider';
import { authService, destinationFor, type Role } from '../auth/service';
import { errorMessage } from '../auth/validation';

/** Authenticated landing boundary; care dashboards are a separate integration. */
export default function AccountPage({ role }: { role: Role }) {
  const { user, setUser, restoring } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  if (restoring) return <AuthLayout title="Checking session" variant="other"><div className="form-content"><Notice>Checking your session…</Notice></div></AuthLayout>;
  if (!user) return <Navigate to={`/login?role=${role}`} replace />;
  if (user.role !== role) return <Navigate to={destinationFor(user.role)} replace />;
  async function signOut() {
    setLoading(true); setError('');
    try { await authService.logout(); setUser(null); navigate(`/login?role=${role}`, { replace: true }); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }
  return <AuthLayout title={role === 'patient' ? 'Your account' : 'Consultant account'} variant="other">
    <div className="page-heading"><h1>{role === 'patient' ? 'Welcome to your space' : 'Your consultant account'}</h1><p>You’re signed in as {user.email}.</p></div>
    <div className="form-content account-content">
      <Notice>Your account is connected. The care workspace is not connected to this interface yet.</Notice>
      {error && <Notice error>{error}</Notice>}
      <Button type="button" loading={loading} onClick={signOut}>{loading ? 'Signing out…' : 'Sign Out'}</Button>
    </div>
  </AuthLayout>;
}
