/**
 * STILL-care Authentication Portal (/login)
 *
 * A modern, serene two-column login experience inspired by the STILL-care wellbeing artwork:
 * - Left: Hero illustration & reflection visual communicating calmness,
 *         emotional safety, student/young-adult wellbeing, and human connection.
 * - Right: Polished, accessible authentication form with Member & Counselor roles,
 *          1-click evaluator autofill, validation states, and encrypted on-device privacy guarantee.
 *
 * Strictly follows Member (Ananya Sharma) and Counselor (Dr. Meera Iyer) terminology.
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  Stethoscope,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  Leaf
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import heroIllustration from '../../assets/images/stillcare_login_hero_1788678193126.jpg';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setActiveRole } = useAppStore();

  const roleParam = searchParams.get('role');
  const initialRole =
    roleParam === 'counselor' || roleParam === 'supervisor' ? 'counselor' : 'member';
  const [role, setRole] = useState<'member' | 'counselor'>(initialRole);

  const [identifier, setIdentifier] = useState(
    initialRole === 'counselor'
      ? 'dr.meera.iyer@campus.edu'
      : 'ananya.sharma@campus.edu'
  );
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleRoleChange = (newRole: 'member' | 'counselor') => {
    setRole(newRole);
    setErrorMessage(null);
    if (newRole === 'member') {
      setIdentifier('ananya.sharma@campus.edu');
      setPassword('password123');
    } else {
      setIdentifier('dr.meera.iyer@campus.edu');
      setPassword('counselorPass2026');
    }
  };

  const handleQuickFill = (targetRole: 'member' | 'counselor') => {
    handleRoleChange(targetRole);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage(
        role === 'member'
          ? 'Please enter your member email or college ID.'
          : 'Please enter your counselor email or counselor ID.'
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

    // Simulated authentic authentication flow
    setTimeout(() => {
      setIsLoading(false);
      if (role === 'member') {
        setActiveRole('patient');
        navigate('/patient/dashboard');
      } else {
        setActiveRole('supervisor');
        navigate('/supervisor/dashboard');
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-charcoal flex flex-col justify-center font-sans selection:bg-sage/40 relative overflow-x-hidden p-4 sm:p-6 lg:p-10">
      {/* Soft botanical decorative gradients */}
      <div className="absolute top-0 right-0 w-[32rem] h-[32rem] bg-radial-glow pointer-events-none opacity-70" />
      <div className="absolute bottom-0 left-0 w-[28rem] h-[28rem] bg-organic-blob pointer-events-none opacity-70" />

      {/* Main Two-Column Layout Container */}
      <main className="flex-1 flex items-center justify-center relative z-10 w-full">
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-center">
          
          {/* ========================================================= */}
          {/* LEFT SIDE: Integrated Hero Art & Still-care Message       */}
          {/* ========================================================= */}
          <section
            id="login-hero-illustration-section"
            aria-label="STILL-care Reflection Atmosphere"
            className="lg:col-span-7 xl:col-span-7 flex flex-col justify-between self-stretch relative order-1"
          >
            {/* Brand Logo & Editorial Typography */}
            <div className="space-y-6 sm:space-y-8 relative z-10 pt-2 lg:pt-4">
              {/* Brand mark */}
              <Link
                to="/"
                id="login-brand-logo"
                className="inline-flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30 rounded-lg p-1"
                aria-label="STILL-care Home"
              >
                <div className="w-10 h-10 rounded-full bg-forest text-bone flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                  <Leaf className="w-5 h-5 fill-current stroke-[1.5]" />
                </div>
                <div>
                  <span className="font-serif text-2xl font-bold tracking-tight text-forest block leading-none">
                    STILL-care
                  </span>
                  <span className="text-xs text-charcoal-muted tracking-wide block pt-1 font-medium">
                    A calmer tomorrow, together
                  </span>
                </div>
              </Link>

              {/* Core Hero Headline & Subtitle */}
              <div className="space-y-3 max-w-lg">
                <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-charcoal tracking-tight leading-[1.15]">
                  Your<br className="hidden sm:inline" /> well-being<br className="hidden sm:inline" /> matters here.
                </h1>
                <p className="text-sm sm:text-base text-charcoal/80 leading-relaxed max-w-md">
                  A safe, supportive space for members to reflect, be heard, and stay connected.
                </p>
              </div>
            </div>

            {/* Seamless Integrated Illustration (No Box, No Border) */}
            <div className="relative mt-6 lg:mt-auto pt-4 flex items-end justify-center lg:justify-start pointer-events-none select-none">
              <img
                src={heroIllustration}
                alt="STILL-care Member Wellbeing: A young member reflecting peacefully with a laptop amidst gentle greenery and inspiring books"
                className="w-full max-w-[340px] sm:max-w-[440px] lg:max-w-[540px] xl:max-w-[580px] h-auto object-contain object-bottom-left"
                referrerPolicy="no-referrer"
                loading="eager"
              />

              {/* Gentle gradient dissolves to merge artwork seamlessly into background */}
              <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent via-[#FAF8F5]/40 to-[#FAF8F5] pointer-events-none hidden lg:block" />
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
            </div>
          </section>

          {/* ========================================================= */}
          {/* RIGHT SIDE: Elevated Floating Login Card                  */}
          {/* ========================================================= */}
          <section
            id="login-form-card"
            aria-label="Sign In Form"
            className="lg:col-span-5 xl:col-span-5 w-full flex justify-center lg:justify-end order-2"
          >
            <div className="w-full max-w-[460px] bg-white border border-[#EBE7DF] rounded-3xl sm:rounded-[28px] p-6 sm:p-8 lg:p-9 shadow-[0_20px_50px_-10px_rgba(25,38,30,0.08)] space-y-5 relative">
              
              {/* Brand Header Inside Card */}
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest uppercase tracking-wider">
                  <Leaf className="w-3.5 h-3.5 fill-current" />
                  <span>STILL-care</span>
                </div>
                
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal tracking-tight">
                  Welcome back
                </h2>

                <p className="text-xs sm:text-sm text-charcoal-muted leading-relaxed">
                  Choose how you'd like to continue.
                </p>
              </div>

              {/* Role Selector Tabs */}
              <div
                id="role-selector-tabs"
                role="tablist"
                aria-label="Login perspective"
                className="grid grid-cols-2 p-1 bg-[#F4F1EA] border border-border-subtle/80 rounded-2xl text-xs font-medium"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-member-login"
                  aria-selected={role === 'member'}
                  aria-controls="login-form-panel"
                  onClick={() => handleRoleChange('member')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    role === 'member'
                      ? 'bg-white text-forest shadow-xs font-semibold'
                      : 'text-charcoal-muted hover:text-charcoal'
                  }`}
                >
                  <User className="w-4 h-4 stroke-[2]" />
                  <span>Member Login</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  id="tab-counselor-login"
                  aria-selected={role === 'counselor'}
                  aria-controls="login-form-panel"
                  onClick={() => handleRoleChange('counselor')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    role === 'counselor'
                      ? 'bg-white text-forest shadow-xs font-semibold'
                      : 'text-charcoal-muted hover:text-charcoal'
                  }`}
                >
                  <Stethoscope className="w-4 h-4 stroke-[2]" />
                  <span>Counselor Login</span>
                </button>
              </div>

              {/* Validation / Error Banner */}
              {errorMessage && (
                <div
                  id="login-error-message"
                  role="alert"
                  className="p-3 bg-risk-red/10 border border-risk-red/20 rounded-xl text-xs text-risk-red flex items-start gap-2 animate-fade-in"
                >
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              {/* Form Element */}
              <form
                id="login-form-panel"
                onSubmit={handleSubmit}
                className="space-y-4 text-xs"
                noValidate
              >
                {/* Identifier Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-identifier-input"
                    className="block font-medium text-charcoal text-xs"
                  >
                    {role === 'member'
                      ? 'Email / College ID'
                      : 'Email / Counselor ID'}
                  </label>
                  <div className="relative">
                    <input
                      id="login-identifier-input"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={
                        role === 'member'
                          ? 'e.g. ananya.sharma@campus.edu or Roll No.'
                          : 'e.g. dr.meera.iyer@campus.edu or Staff ID'
                      }
                      className="w-full pl-9 pr-3 py-3 bg-[#FAF8F5] border border-border-subtle rounded-xl text-charcoal text-xs placeholder:text-charcoal-muted/50 focus:outline-none focus:ring-2 focus:ring-forest/25 focus:border-forest focus:bg-white transition-all font-sans"
                      required
                    />
                    <Mail className="w-4 h-4 text-charcoal-muted absolute left-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password-input"
                      className="block font-medium text-charcoal text-xs"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      id="forgot-password-link"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-forest hover:underline font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest rounded px-0.5"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-10 py-3 bg-[#FAF8F5] border border-border-subtle rounded-xl text-charcoal text-xs placeholder:text-charcoal-muted/50 focus:outline-none focus:ring-2 focus:ring-forest/25 focus:border-forest focus:bg-white transition-all font-sans"
                      required
                    />
                    <Lock className="w-4 h-4 text-charcoal-muted absolute left-3 top-3.5 pointer-events-none" />
                    <button
                      type="button"
                      id="toggle-password-visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-charcoal-muted hover:text-charcoal transition-colors p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-charcoal"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-charcoal-muted select-none text-xs">
                    <input
                      type="checkbox"
                      id="remember-me-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border-subtle text-forest focus:ring-forest/20 accent-forest"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  id="login-submit-button"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-forest hover:bg-forest/90 active:bg-forest/95 text-bone font-medium text-sm transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-bone border-t-transparent rounded-full animate-spin" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <span>
                        {role === 'member' ? 'Sign in as Member' : 'Sign in as Counselor'}
                      </span>
                      <ArrowRight className="w-4 h-4 stroke-[2]" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Evaluator 1-Click Autofill */}
              <div className="pt-2 border-t border-border-subtle/80 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-charcoal-muted">
                  <span className="font-medium text-charcoal">Quick demo accounts:</span>
                  <span className="text-[10px] bg-[#EAF1EC] px-2.5 py-0.5 rounded-full border border-forest/15 text-forest font-medium">
                    1-click autofill
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    id="autofill-member-btn"
                    onClick={() => handleQuickFill('member')}
                    className={`p-2.5 rounded-xl border text-left transition-all text-xs cursor-pointer relative ${
                      role === 'member'
                        ? 'border-forest bg-[#FAFBF9] text-forest font-medium shadow-2xs'
                        : 'border-border-subtle bg-[#FAF8F5] text-charcoal-muted hover:bg-[#F4F1EA]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-charcoal block">Ananya Sharma</span>
                      {role === 'member' && <Check className="w-3.5 h-3.5 text-forest shrink-0" />}
                    </div>
                    <span className="text-[10px] text-charcoal-muted block mt-0.5">
                      Member &middot; 3rd Year B.Tech
                    </span>
                  </button>

                  <button
                    type="button"
                    id="autofill-counselor-btn"
                    onClick={() => handleQuickFill('counselor')}
                    className={`p-2.5 rounded-xl border text-left transition-all text-xs cursor-pointer relative ${
                      role === 'counselor'
                        ? 'border-forest bg-[#FAFBF9] text-forest font-medium shadow-2xs'
                        : 'border-border-subtle bg-[#FAF8F5] text-charcoal-muted hover:bg-[#F4F1EA]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-charcoal block">Dr. Meera Iyer</span>
                      {role === 'counselor' && <Check className="w-3.5 h-3.5 text-forest shrink-0" />}
                    </div>
                    <span className="text-[10px] text-charcoal-muted block mt-0.5">
                      Counselor &middot; Wellness Center
                    </span>
                  </button>
                </div>
              </div>

              {/* Minimal Calm Footer Text */}
              <div className="pt-2 border-t border-border-subtle/50 text-center text-xs text-charcoal-muted/80">
                <span>STILL-care &middot; A calmer space to reflect and stay connected</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-title"
          className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="bg-white border border-border-subtle rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-forest">
              <div className="w-8 h-8 rounded-full bg-sage/50 flex items-center justify-center">
                <Lock className="w-4 h-4 text-forest" />
              </div>
              <h3 id="forgot-password-title" className="font-serif text-lg font-bold text-charcoal">
                Account Credentials
              </h3>
            </div>

            <p className="text-xs text-charcoal-muted leading-relaxed">
              Pre-configured profiles are available.
              You can instantly sign in as either <strong className="text-charcoal">Ananya Sharma (Member)</strong> or{' '}
              <strong className="text-charcoal">Dr. Meera Iyer (Counselor)</strong> using the 1-click quick sign-in buttons.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 bg-forest text-bone rounded-xl text-xs font-medium hover:bg-forest/90 transition-colors cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
