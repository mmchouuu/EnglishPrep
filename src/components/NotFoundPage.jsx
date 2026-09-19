import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage({ isDarkMode = false }) {
  return (
    <div
      className="min-h-[70vh] flex items-center justify-center p-6 transition-colors"
      style={{
        backgroundColor: isDarkMode ? '#0b1220' : '#f7faff',
        color: isDarkMode ? '#f8fafc' : '#0f172a'
      }}
    >
      <div
        className="max-w-md w-full p-8 rounded-3xl border text-center space-y-5 shadow-xl"
        style={{
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
        }}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
          <AlertTriangle className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-extrabold text-[#2563eb] uppercase tracking-wider block">
            404 — Page Not Found
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Oops! Route Not Found
          </h2>
          <p className="text-xs font-medium leading-relaxed" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
            The page or practice set you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
