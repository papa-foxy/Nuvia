'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

interface LandingViewProps {
  onStartOnboarding: () => void;
  onEnterDashboard: () => void;
}

export function LandingView({ onStartOnboarding, onEnterDashboard }: LandingViewProps) {
  const { signInWithEmail, signInWithGoogle, sendOtp, verifyOtp, resetPassword } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'signup' | 'forgot_password' | null>(null);
  const [otpStep, setOtpStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  // Countdown timer for resending OTP
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    const res = await sendOtp(email, name, password, 'signup');
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to send OTP verification code.');
      return;
    }

    setOtpStep('verify');
    setResendCooldown(60);
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    const res = await verifyOtp(email, otpCode.trim(), name);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid or expired 6-digit code.');
      return;
    }

    setShowAuthModal(null);
    setOtpStep('form');
    setOtpCode('');
    onStartOnboarding();
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    const res = await signInWithEmail(email, password);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    setShowAuthModal(null);
    onEnterDashboard();
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    const res = await signInWithGoogle();
    if (res?.error) {
      setErrorMsg(res.error);
      setLoading(false);
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    const res = await sendOtp(email, undefined, undefined, 'reset_password');
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to send reset code.');
      return;
    }

    setOtpStep('verify');
    setResendCooldown(60);
  };

  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the complete 6-digit reset code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    const res = await resetPassword(email, otpCode.trim(), newPassword);

    if (!res.success) {
      setLoading(false);
      setErrorMsg(res.error || 'Invalid or expired reset code.');
      return;
    }

    // Automatically sign in with the new password
    const loginRes = await signInWithEmail(email, newPassword);
    setLoading(false);

    if (!loginRes.error) {
      setShowAuthModal(null);
      onEnterDashboard();
    } else {
      setShowAuthModal('login');
      setOtpStep('form');
      setSuccessMsg('Password updated successfully. Please log in.');
    }
  };

  const openModal = (mode: 'login' | 'signup' | 'forgot_password') => {
    setShowAuthModal(mode);
    setOtpStep('form');
    setErrorMsg('');
    setSuccessMsg('');
    setOtpCode('');
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white overflow-hidden flex flex-col justify-between">
      {/* Ambient background with glowing emerald waves & dot matrix */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/onboarding-bg.webp'), url('/onboarding-bg.png')",
        }}
      >
        {/* Soft vignette/gradient overlay for contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/65 backdrop-blur-[1px]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md mx-auto min-h-screen flex flex-col justify-between px-6 py-10">
        {/* Top Brand Mark */}
        <div className="pt-2 flex items-center gap-2.5">
          <img
            src="/icon.png"
            alt="Nuvia Logo"
            className="w-8 h-8 rounded-xl shadow-lg shadow-emerald-500/25 border border-emerald-400/20"
          />
          <span className="text-xl font-bold tracking-tight text-white">
            Nuvia
          </span>
        </div>

        {/* Hero Body */}
        <div className="my-auto py-12 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Intelligent Nutrition &amp; Fitness
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Your Health,<br />
            <span className="bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
              Smarter.
            </span>
          </h1>
          <p className="text-sm text-[#A1A1A6] leading-relaxed max-w-xs font-normal">
            Track what you eat with a photo or natural prompt, record movement, and let Nuvia provide clear, actionable daily nutrition advice.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pb-4">
          <button
            onClick={() => openModal('signup')}
            className="w-full py-4 rounded-full bg-white hover:bg-[#F5F5F7] text-black font-bold text-sm transition-all shadow-xl shadow-white/10 active:scale-[0.98]"
          >
            Get Started
          </button>

          <button
            onClick={() => openModal('login')}
            className="w-full py-4 rounded-full bg-black/40 hover:bg-black/60 text-white font-semibold text-sm transition-colors border border-white/15 backdrop-blur-md"
          >
            Log In
          </button>

          <button
            onClick={onStartOnboarding}
            className="w-full py-2.5 text-center text-xs text-[#8E8E93] hover:text-emerald-400 transition-colors font-medium"
          >
            Or preview onboarding as guest →
          </button>
        </div>
      </div>

      {/* Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-[#0E1511]/95 border border-emerald-500/20 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl shadow-emerald-950/60 backdrop-blur-2xl animate-slideUp">
            
            {/* Header */}
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-1">
                {showAuthModal === 'signup'
                  ? otpStep === 'verify'
                    ? 'Verify Your Email'
                    : 'Create Your Account'
                  : showAuthModal === 'forgot_password'
                  ? otpStep === 'verify'
                    ? 'Set New Password'
                    : 'Reset Password'
                  : 'Welcome Back'}
              </h3>
              <p className="text-xs text-[#8E8E93]">
                {showAuthModal === 'signup'
                  ? otpStep === 'verify'
                    ? `Enter the 6-digit code sent to ${email}`
                    : 'Create your credentials to get started.'
                  : showAuthModal === 'forgot_password'
                  ? otpStep === 'verify'
                    ? `Enter the 6-digit reset code sent to ${email}`
                    : 'Enter your email address to receive a 6-digit reset code.'
                  : 'Sign in with your email and password.'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-3.5 p-3 rounded-xl bg-[#FF453A]/10 border border-[#FF453A]/20 text-xs text-[#FF453A]">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-3.5 p-3 rounded-xl bg-[#30D158]/10 border border-[#30D158]/20 text-xs text-[#30D158]">
                {successMsg}
              </div>
            )}



            {/* ======================================================= */}
            {/* 1. REGISTRATION (SIGN UP) FLOW                          */}
            {/* ======================================================= */}
            {showAuthModal === 'signup' && (
              <>
                {otpStep === 'form' ? (
                  <form onSubmit={handleRegisterSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Syazwan"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                        Create Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                      />
                      <p className="text-[11px] text-[#636366] mt-1">
                        Must be at least 6 characters long.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] text-black font-semibold text-sm transition-colors"
                    >
                      {loading ? 'Sending code...' : 'Continue & Verify Email'}
                    </button>

                    {/* Divider */}
                    <div className="relative flex py-1.5 items-center">
                      <div className="flex-grow border-t border-white/10"></div>
                      <span className="flex-shrink mx-3 text-[11px] text-[#8E8E93] font-medium uppercase">or</span>
                      <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    {/* Google Sign In */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                      className="w-full py-3 px-4 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2.5 border border-white/10"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5 text-center">
                        6-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        required
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="w-full text-center tracking-[0.4em] font-mono text-2xl py-3 rounded-2xl bg-[#121214] border border-white/[0.1] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="w-full py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-semibold text-sm transition-colors"
                    >
                      {loading ? 'Verifying...' : 'Verify & Complete Registration'}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('form');
                          setErrorMsg('');
                        }}
                        className="text-[#8E8E93] hover:text-white"
                      >
                        Change Details
                      </button>

                      <button
                        type="button"
                        disabled={resendCooldown > 0 || loading}
                        onClick={(e) => handleRegisterSubmit(e)}
                        className="text-[#30D158] hover:underline disabled:text-[#8E8E93] font-medium"
                      >
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* ======================================================= */}
            {/* 2. LOGIN FLOW (EMAIL & PASSWORD ONLY)                    */}
            {/* ======================================================= */}
            {showAuthModal === 'login' && (
              <form onSubmit={handlePasswordLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => openModal('forgot_password')}
                      className="text-xs text-[#30D158] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] text-black font-semibold text-sm transition-colors"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>

                {/* Divider */}
                <div className="relative flex py-1.5 items-center">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink mx-3 text-[11px] text-[#8E8E93] font-medium uppercase">or</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2.5 border border-white/10"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>
            )}

            {/* ======================================================= */}
            {/* 3. FORGOT / RESET PASSWORD FLOW                         */}
            {/* ======================================================= */}
            {showAuthModal === 'forgot_password' && (
              <>
                {otpStep === 'form' ? (
                  <form onSubmit={handleSendResetCode} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] text-black font-semibold text-sm transition-colors"
                    >
                      {loading ? 'Sending code...' : 'Send Reset Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyAndResetPassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5 text-center">
                        6-Digit Reset Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        required
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="w-full text-center tracking-[0.4em] font-mono text-2xl py-3 rounded-2xl bg-[#121214] border border-white/[0.1] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#121214] border border-white/[0.06] text-white focus:outline-none focus:border-[#30D158]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpCode.length !== 6 || newPassword.length < 6}
                      className="w-full mt-2 py-3.5 rounded-full bg-[#30D158] hover:bg-[#28B84D] disabled:opacity-50 text-black font-semibold text-sm transition-colors"
                    >
                      {loading ? 'Resetting...' : 'Save New Password & Sign In'}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep('form');
                          setErrorMsg('');
                        }}
                        className="text-[#8E8E93] hover:text-white"
                      >
                        Change Email
                      </button>

                      <button
                        type="button"
                        disabled={resendCooldown > 0 || loading}
                        onClick={(e) => handleSendResetCode(e)}
                        className="text-[#30D158] hover:underline disabled:text-[#8E8E93] font-medium"
                      >
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* Modal Bottom Switchers */}
            <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() =>
                  openModal(showAuthModal === 'login' ? 'signup' : 'login')
                }
                className="text-[#8E8E93] hover:text-white"
              >
                {showAuthModal === 'login'
                  ? 'Need an account? Sign up'
                  : 'Already registered? Log in'}
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(null)}
                className="text-[#8E8E93] hover:text-white"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
