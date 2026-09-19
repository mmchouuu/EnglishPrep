import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Menu, X, LayoutGrid } from 'lucide-react';
import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

export const Navbar = ({ darkMode, setDarkMode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    async function initUser() {
      try {
        const client = getBrowserSupabaseClient();
        if (!client) return;
        const { data: { session } } = await client.auth.getSession();
        setUser(session?.user || null);

        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
      } catch (err) {}
    }
    initUser();
  }, []);

  const handleSignOut = async () => {
    try {
      const client = getBrowserSupabaseClient();
      if (client) {
        await client.auth.signOut();
        setUser(null);
      }
    } catch (err) {}
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/', isExact: true },
    { id: 'listening', label: 'Listening', path: '/listening/part-1', prefix: '/listening' },
    { id: 'reading', label: 'Reading', path: '/reading/part-1', prefix: '/reading' },
    { id: 'writing', label: 'Writing', path: '/writing/part-1', prefix: '/writing' },
    { id: 'speaking', label: 'Speaking', path: '/speaking/part-1', prefix: '/speaking' },
    { id: 'admin', label: 'Test Database', path: '/test-database', prefix: '/test-database' }
  ];

  const checkIsActive = (item) => {
    if (item.isExact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.prefix);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        darkMode
          ? 'bg-[#0f172a]/95 border-slate-800 text-slate-100 backdrop-blur-md'
          : 'bg-white/95 border-[#dbe4f0] text-[#0f172a] backdrop-blur-md shadow-xs'
      }`}
    >
      <div className="max-w-[1536px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* Left: Brand Logo & Online Tests Tag */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2.5 cursor-pointer group focus:outline-none"
            aria-label="Go to Dashboard"
          >
            {/* Blue Rounded Square with 4-grid Icon */}
            <div className="w-10 h-10 rounded-2xl bg-[#2563eb] flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
              <LayoutGrid className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>

            {/* Brand Title: APTIS PREP */}
            <span
              className="font-extrabold text-xl sm:text-2xl tracking-tight whitespace-nowrap"
              style={{ color: darkMode ? '#3b82f6' : '#2563eb' }}
            >
              APTIS PREP
            </span>
          </Link>
        </div>

        {/* Center: Navigation Tabs (Desktop) */}
        <nav
          className="hidden md:flex items-center gap-1.5"
          aria-label="Main Navigation"
        >
          {navItems.map((item) => {
            const isActive = checkIsActive(item);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-[#2563eb] text-white shadow-xs font-bold'
                    : darkMode
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                      : 'text-[#334155] hover:text-[#0f172a] hover:bg-slate-100'
                }`}
                style={!isActive ? { color: darkMode ? '#cbd5e1' : '#334155' } : {}}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: User Auth & Theme Toggle Button */}
        <div className="flex items-center gap-2">
          {/* User Auth Info / Actions */}
          {user ? (
            <div className="flex items-center gap-2.5">
              {/* Circular Gmail-style Avatar */}
              <div
                title={user.email}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2563eb] to-[#4f46e5] text-white font-extrabold text-sm flex items-center justify-center shadow-md shadow-blue-500/25 ring-2 ring-blue-400/30 shrink-0 cursor-default select-none transition-transform hover:scale-105"
              >
                {(user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleSignOut}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              to={`/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all"
            >
              Sign In
            </Link>
          )}

          {/* Dark / Light Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label={`Switch to ${darkMode ? 'Light' : 'Dark'} mode`}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-[#cbd5e1] text-[#0f172a] hover:bg-slate-50 shadow-xs'
            }`}
            style={{ color: darkMode ? '#f1f5f9' : '#0f172a' }}
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
                <span>Dark</span>
              </>
            )}
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className={`md:hidden p-1.5 rounded-lg border transition-colors ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-white border-[#dbe4f0] text-slate-700'
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#dbe4f0] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = checkIsActive(item);
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-[#2563eb] text-white font-bold'
                    : darkMode
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-[#334155] hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default Navbar;

