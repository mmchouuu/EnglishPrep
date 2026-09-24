import React, { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useOutletContext
} from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ReadingPractice } from './components/ReadingPractice';
import { ListeningPractice } from './components/ListeningPractice';
import { SpeakingPractice } from './components/SpeakingPractice';
import { WritingPractice } from './components/WritingPractice';
import { AdminCMS } from './components/AdminCMS';
import { NotFoundPage } from './components/NotFoundPage';
import { LoginPage } from './components/LoginPage';

function AppShell({ darkMode, setDarkMode }) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-200 ${
        darkMode ? 'bg-[#090d16] text-slate-100' : 'bg-[#f7faff] text-slate-900'
      }`}
    >
      <div>
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <main className="pb-12">
          <Outlet context={{ isDarkMode: darkMode }} />
        </main>
      </div>

      {/* Global Floating Back to Top Button */}
      {showScrollTop && (
        <button
          aria-label="Back to top"
          onClick={scrollToTop}
          className="fixed bottom-20 right-6 z-50 p-3 rounded-full bg-[#2563eb] hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-blue-400/30"
          title="Scroll to top"
        >
          <ChevronUp className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
        </button>
      )}

      {/* Footer */}
      <footer
        className={`border-t py-6 px-4 text-center text-xs transition-colors ${
          darkMode
            ? 'bg-[#0f172a] border-slate-800/80 text-slate-400'
            : 'bg-white border-slate-200/80 text-slate-500'
        }`}
      >
        <div className="max-w-[1536px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 APTIS PREP • Online Tests & Aptis Practice Platform</p>
          <p className="font-medium">Responsive UI aligned directly with design reference screenshots</p>
        </div>
      </footer>
    </div>
  );
}

function PageWrapper({ Component }) {
  const { isDarkMode } = useOutletContext() || {};
  return <Component isDarkMode={isDarkMode} />;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('aptis:theme');
    if (saved !== null) {
      return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('aptis:theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell darkMode={darkMode} setDarkMode={setDarkMode} />}>
          {/* Dashboard */}
          <Route index element={<PageWrapper Component={Dashboard} />} />

          {/* Reading Routes */}
          <Route path="reading">
            <Route index element={<Navigate to="part-1" replace />} />
            <Route path=":partId" element={<PageWrapper Component={ReadingPractice} />} />
          </Route>

          {/* Listening Routes */}
          <Route path="listening">
            <Route index element={<Navigate to="part-1" replace />} />
            <Route path=":partId" element={<PageWrapper Component={ListeningPractice} />} />
          </Route>

          {/* Speaking Routes */}
          <Route path="speaking">
            <Route index element={<Navigate to="part-1" replace />} />
            <Route path=":partId" element={<PageWrapper Component={SpeakingPractice} />} />
          </Route>

          {/* Writing Routes */}
          <Route path="writing">
            <Route index element={<Navigate to="part-1" replace />} />
            <Route path=":partId" element={<PageWrapper Component={WritingPractice} />} />
          </Route>

          {/* Test Database (Temporarily hidden) */}
          <Route path="test-database" element={<Navigate to="/" replace />} />

          {/* Login Route */}
          <Route path="login" element={<PageWrapper Component={LoginPage} />} />

          {/* Wildcard 404 */}
          <Route path="*" element={<PageWrapper Component={NotFoundPage} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
