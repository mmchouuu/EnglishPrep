import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';
import { Lock, Mail, Key, LogIn, UserPlus, AlertCircle, CircleCheck, ArrowLeft, RefreshCw } from 'lucide-react';

export function LoginPage({ isDarkMode = false }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = searchParams.get('redirectTo') || location.state?.from || '/reading/part-1';

  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Check existing session
  useEffect(() => {
    async function checkAuth() {
      try {
        const client = getBrowserSupabaseClient();
        if (!client) return;
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user);
        }
      } catch (err) {}
    }
    checkAuth();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const client = getBrowserSupabaseClient();
      if (!client) {
        throw new Error('Supabase client is not available. Check environment variables.');
      }

      if (activeTab === 'signin') {
        const { data, error: authError } = await client.auth.signInWithPassword({
          email,
          password
        });

        if (authError) {
          throw new Error(authError.message || 'Invalid email or password.');
        }

        if (data?.session) {
          navigate(redirectTo, { replace: true });
        }
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email,
          password
        });

        if (authError) {
          throw new Error(authError.message || 'Failed to create account.');
        }

        if (data?.session) {
          // Auto signed in
          navigate(redirectTo, { replace: true });
        } else {
          setSuccessMessage('Account registered successfully! You can now sign in.');
          setActiveTab('signin');
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const client = getBrowserSupabaseClient();
      if (client) {
        await client.auth.signOut();
        setCurrentUser(null);
        setSuccessMessage('You have signed out successfully.');
      }
    } catch (err) {}
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 transition-colors"
      style={{
        backgroundColor: isDarkMode ? '#090d16' : '#f7faff',
        color: isDarkMode ? '#f8fafc' : '#0f172a'
      }}
    >
      <div className="max-w-md w-full space-y-6">

        {/* Back Link */}
        <div>
          <button
            onClick={() => navigate(redirectTo)}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#2563eb] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Practice</span>
          </button>
        </div>

        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#2563eb] flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/20">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            {currentUser ? 'Account Session' : 'Sign in to APTIS PREP'}
          </h2>
          <p className="text-xs font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            {currentUser ? `Currently signed in as ${currentUser.email}` : 'Access official Aptis Reading practice questions'}
          </p>
        </div>

        {/* Signed-in Card */}
        {currentUser ? (
          <div
            className="p-6 rounded-2xl border space-y-4 shadow-xl text-center"
            style={{
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
              borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
            }}
          >
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl inline-flex items-center gap-2 text-xs font-bold">
              <CircleCheck className="w-4 h-4" />
              <span>Authenticated Session Active</span>
            </div>
            <p className="text-xs font-medium">User ID: <code className="text-blue-500">{currentUser.id}</code></p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate(redirectTo)}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
              >
                Continue Practice
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-rose-500 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Authentication Form Card */
          <div
            className="p-6 rounded-2xl border shadow-xl space-y-5"
            style={{
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
              borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
            }}
          >
            {/* Tabs: Sign In / Sign Up */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => { setActiveTab('signin'); setError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'signin'
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('signup'); setError(null); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'signup'
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </div>
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-start gap-2">
                <CircleCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:border-blue-500 transition-colors"
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                      color: isDarkMode ? '#ffffff' : '#0f172a'
                    }}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold" style={{ color: isDarkMode ? '#e2e8f0' : '#334155' }}>
                  Password
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs font-semibold border outline-none focus:border-blue-500 transition-colors"
                    style={{
                      backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                      borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                      color: isDarkMode ? '#ffffff' : '#0f172a'
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{activeTab === 'signin' ? 'Signing in...' : 'Registering...'}</span>
                  </>
                ) : (
                  <span>{activeTab === 'signin' ? 'Sign In' : 'Create Account'}</span>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default LoginPage;
