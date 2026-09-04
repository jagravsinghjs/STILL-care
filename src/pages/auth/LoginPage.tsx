/**
 * STILL-care Authentication Portal (/login)
 *
 * Provides a serene, campus-tailored sign-in experience for:
 * - Student Login (Ananya Sharma) -> directs to /patient/dashboard
 * - Counselor Login (Dr. Meera Iyer) -> directs to /supervisor/dashboard
 *
 * Features:
 * - Role selector tabs
 * - Quick-fill demo credentials for evaluator convenience
 * - Password visibility toggle
 * - Form validation and simulated authentication loading
 * - On-device reflection privacy reassurance
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Stethoscope,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  HeartHandshake,
  Check
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setActiveRole } = useAppStore();

  const initialRole = searchParams.get('role') === 'counselor' ? 'counselor' : 'student';
  const [role, setRole] = useState<'student' | 'counselor'>(initialRole);

  const [identifier, setIdentifier] = useState(
    initialRole === 'counselor' ? 'dr.meera.iyer@campus.edu' : 'ananya.sharma@campus.edu'
  );
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleRoleChange = (newRole: 'student' | 'counselor') => {
    setRole(newRole);
    setErrorMessage(null);
    if (newRole === 'student') {
      setIdentifier('ananya.sharma@campus.edu');
      setPassword('password123');
    } else {
      setIdentifier('dr.meera.iyer@campus.edu');
      setPassword('counselorPass2026');
    }
  };

  const handleQuickFill = (targetRole: 'student' | 'counselor') => {
    handleRoleChange(targetRole);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage(
        role === 'student'
          ? 'Please enter your student email or campus Roll No.'
          : 'Please enter your counselor email or staff ID.'
      );
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    // Simulate authentic network authentication
    setTimeout(() => {
      setIsLoading(false);
      if (role === 'student') {
        setActiveRole('patient');
        navigate('/patient/dashboard');
      } else {
        setActiveRole('supervisor');
        navigate('/supervisor/dashboard');
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-bone text-charcoal flex flex-col justify-between font-sans selection:bg-sage/40 relative overflow-hidden">
      {/* Soft botanical decorative gradients */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-radial-glow pointer-events-none opacity-80" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-organic-blob pointer-events-none opacity-80" />

      {/* Top Header */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-forest text-bone flex items-center justify-center font-serif font-bold text-sm">
            S
          </div>
          <div>
            <span className="font-serif text-xl font-semibold tracking-tight text-charcoal block leading-none">
              STILL-care
            </span>
            <span className="text-[10px] text-charcoal-muted tracking-wide block pt-0.5">
              Campus Student Wellbeing Platform
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs text-charcoal-muted bg-paper-grey/70 border border-border-subtle px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-secondary-green" />
          <span className="hidden sm:inline">Encrypted on-device reflections</span>
          <span className="sm:hidden">Private space</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-md bg-white border border-border-subtle rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Brand Welcome */}
          <div className="text-center space-y-1.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs sm:text-sm text-charcoal-muted max-w-xs mx-auto leading-relaxed">
              Take a quiet moment for yourself. Sign in to continue your reflections.
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="grid grid-cols-2 p-1 bg-paper-grey/80 border border-border-subtle rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => handleRoleChange('student')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                role === 'student'
                  ? 'bg-white text-forest shadow-xs font-semibold'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Student Login</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('counselor')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                role === 'counselor'
                  ? 'bg-white text-forest shadow-xs font-semibold'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Counselor Login</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-risk-red/10 border border-risk-red/20 rounded-xl text-xs text-risk-red flex items-start gap-2">
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Identifier Field */}
            <div className="space-y-1.5">
              <label htmlFor="login-identifier" className="block font-medium text-charcoal">
                {role === 'student' ? 'Student email or Roll Number' : 'Staff email or Counselor ID'}
              </label>
              <div className="relative">
                <input
                  id="login-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    role === 'student'
                      ? 'e.g. ananya.sharma@campus.edu'
                      : 'e.g. dr.meera.iyer@campus.edu'
                  }
                  className="w-full pl-9 pr-3 py-2.5 bg-paper-grey/40 border border-border-subtle rounded-xl text-charcoal placeholder:text-charcoal-muted/50 focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest transition-colors"
                  required
                />
                <Mail className="w-4 h-4 text-charcoal-muted absolute left-3 top-3" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block font-medium text-charcoal">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-secondary-green hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-9 pr-10 py-2.5 bg-paper-grey/40 border border-border-subtle rounded-xl text-charcoal placeholder:text-charcoal-muted/50 focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest transition-colors"
                  required
                />
                <Lock className="w-4 h-4 text-charcoal-muted absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-charcoal-muted hover:text-charcoal transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-charcoal-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border-subtle text-forest focus:ring-forest/20"
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-forest hover:bg-forest/90 text-bone font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-bone border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign in as {role === 'student' ? 'Student' : 'Counselor'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Evaluator Helper Bar */}
          <div className="pt-2 border-t border-border-subtle/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-charcoal-muted">
              <span>Quick demo accounts:</span>
              <span className="text-[10px] bg-paper-grey px-1.5 py-0.5 rounded border border-border-subtle">
                1-click autofill
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('student')}
                className={`p-2 rounded-lg border text-left transition-colors text-[11px] ${
                  role === 'student'
                    ? 'border-forest bg-sage/30 text-forest font-medium'
                    : 'border-border-subtle bg-paper-grey/40 text-charcoal-muted hover:bg-paper-grey'
                }`}
              >
                <span className="font-semibold block text-charcoal">Ananya Sharma</span>
                <span className="text-[10px] text-charcoal-muted">Student demo</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('counselor')}
                className={`p-2 rounded-lg border text-left transition-colors text-[11px] ${
                  role === 'counselor'
                    ? 'border-forest bg-sage/30 text-forest font-medium'
                    : 'border-border-subtle bg-paper-grey/40 text-charcoal-muted hover:bg-paper-grey'
                }`}
              >
                <span className="font-semibold block text-charcoal">Dr. Meera Iyer</span>
                <span className="text-[10px] text-charcoal-muted">Counselor demo</span>
              </button>
            </div>
          </div>

          {/* Privacy reassurance footnote */}
          <div className="p-3 bg-paper-grey/50 rounded-xl border border-border-subtle text-[11px] text-charcoal-muted flex items-start gap-2">
            <HeartHandshake className="w-4 h-4 text-secondary-green shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              STILL-care protects your personal thoughts. Raw conversation reflections remain strictly on-device.
            </p>
          </div>
        </div>
      </main>

      {/* Calm Campus Footer */}
      <footer className="py-4 px-6 text-center text-xs text-charcoal-muted border-t border-border-subtle/60 relative z-10 bg-bone/80">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Campus Counseling & Psychological Support Services &middot; Fictional Demo Environment</span>
          <span className="text-charcoal-muted/70">Supportive listening and distress monitoring</span>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-border-subtle rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-3">
            <h3 className="font-serif text-lg font-semibold text-charcoal">
              Reset your password
            </h3>
            <p className="text-xs text-charcoal-muted leading-relaxed">
              In this campus demo environment, passwords can be reset using standard test credentials or by selecting the 1-click demo accounts above.
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 bg-forest text-bone rounded-lg text-xs font-medium hover:bg-forest/90"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
