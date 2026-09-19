import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BarChart3, CalendarDays, RefreshCw, AlertCircle, LogIn } from 'lucide-react';
import { heroData, initialSkillCards } from '../data/dashboardData';
import { SkillPracticeCard } from './SkillPracticeCard';
import { useDashboardStats } from '../hooks/useDashboardStats';

export const Dashboard = ({ isDarkMode = false }) => {
  const navigate = useNavigate();
  const { stats, loading, unauthenticated, error, retry } = useDashboardStats();

  // Card states stored independently per skill
  const [selectedParts, setSelectedParts] = useState({
    listening: 'Part 1',
    reading: 'Part 1',
    writing: 'Part 1',
    speaking: 'Part 1'
  });

  const [selectedModes, setSelectedModes] = useState({
    listening: 'full',
    reading: 'full',
    writing: 'full',
    speaking: 'full'
  });

  const handlePartChange = (skillId, part) => {
    setSelectedParts((prev) => ({ ...prev, [skillId]: part }));
  };

  const handleModeChange = (skillId, mode) => {
    setSelectedModes((prev) => ({ ...prev, [skillId]: mode }));
  };

  const handleStartPractice = (skillId, part, mode) => {
    const rawPart = (part || 'part-1').toLowerCase().replace(/\s+/g, '-').replace('–', '-');
    let partSlug = rawPart;
    if (skillId === 'reading' && (rawPart === 'part-2' || rawPart === 'part-3' || rawPart === 'part-2-3')) {
      partSlug = 'part-2-3';
    }
    navigate(`/${skillId}/${partSlug}?mode=${mode || 'full'}`);
  };

  // Hero Overview Statistics
  const overallProgressPercent = stats?.overall?.progressPercent ?? 0;
  const overallCompletedParts = stats?.overall?.completedParts ?? 0;
  const studyStreakDays = stats?.overall?.studyStreakDays ?? 0;
  const overallLatestScore = stats?.overall?.latestScore;
  const overallLatestSkill = stats?.overall?.latestSkill;
  const overallCefrLevel = stats?.overall?.cefrLevel;

  // Hero SVG circular progress ring calculations
  const heroRadius = 24;
  const heroCircumference = 2 * Math.PI * heroRadius;
  const heroDashoffset = heroCircumference - (overallProgressPercent / 100) * heroCircumference;

  // Theme text helpers
  const headingColor = isDarkMode ? '#ffffff' : '#0f172a';
  const textColor = isDarkMode ? '#e2e8f0' : '#334155';
  const mutedColor = isDarkMode ? '#cbd5e1' : '#475569';

  return (
    <div className="max-w-[1536px] mx-auto px-4 lg:px-8 pt-6 pb-12 space-y-7 transition-colors">
      
      {/* Unauthenticated Notification Banner */}
      {unauthenticated && (
        <div
          className="p-4 rounded-xl border flex items-center justify-between gap-4 transition-all"
          style={{
            backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff',
            borderColor: isDarkMode ? '#1e40af' : '#bfdbfe'
          }}
        >
          <div className="flex items-center gap-3">
            <LogIn className="w-5 h-5 text-[#2563eb] shrink-0" />
            <span className="text-xs sm:text-sm font-semibold" style={{ color: headingColor }}>
              Sign in to track your personal Aptis practice progress and saved scores.
            </span>
          </div>
          <Link
            to="/login"
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shrink-0 transition-all shadow-xs"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Error Retry Banner */}
      {error && !loading && (
        <div
          className="p-4 rounded-xl border flex items-center justify-between gap-4 transition-all"
          style={{
            backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.4)' : '#fef2f2',
            borderColor: isDarkMode ? '#991b1b' : '#fecaca'
          }}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </span>
          </div>
          <button
            onClick={retry}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shrink-0 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 1. Hero Overview Section */}
      <section
        aria-label="Hero Overview"
        className="p-6 lg:p-8 rounded-2xl border transition-all dashboard-hero"
        style={{
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          borderColor: isDarkMode ? '#29364a' : '#dbe4f0'
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Left Title & Eyebrow */}
          <div className="space-y-1.5 max-w-xl">
            <span className="text-[11px] font-extrabold text-[#2563eb] tracking-wider uppercase block">
              {heroData.eyebrow}
            </span>
            <h1
              className="text-2xl sm:text-3xl font-extrabold tracking-tight"
              style={{ color: headingColor }}
            >
              {heroData.heading}
            </h1>
            <p
              className="text-xs sm:text-sm font-medium leading-relaxed"
              style={{ color: mutedColor }}
            >
              {heroData.subtitle}
            </p>
          </div>

          {/* Right Statistics Widgets */}
          <div
            className="flex flex-wrap lg:flex-nowrap items-center gap-6 pt-4 lg:pt-0 border-t lg:border-t-0"
            style={{ borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}
          >
            
            {/* Widget 1: Overall Progress */}
            <div className="flex items-center gap-3.5">
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
                  <circle
                    cx="28"
                    cy="28"
                    r={heroRadius}
                    stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r={heroRadius}
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeDasharray={heroCircumference}
                    strokeDashoffset={heroDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <span
                  className="absolute text-xs font-extrabold"
                  style={{ color: headingColor }}
                >
                  {unauthenticated ? '—' : `${overallProgressPercent}%`}
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold" style={{ color: headingColor }}>
                  Overall Progress
                </div>
                <div className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  {unauthenticated ? 'Sign in to track progress' : `${overallCompletedParts} of 16 parts completed`}
                </div>
              </div>
            </div>

            {/* Vertical Divider */}
            <div
              className="hidden sm:block h-12 w-px"
              style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }}
            />

            {/* Widget 2: Latest Test Score */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.7)' : '#eff6ff',
                  color: '#2563eb'
                }}
              >
                <BarChart3 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Latest Test Score
                </div>
                <div className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: headingColor }}>
                  <span>
                    {unauthenticated || overallLatestScore === null || overallLatestScore === undefined
                      ? 'No score yet'
                      : `${overallLatestScore}/100`}
                  </span>
                  {overallCefrLevel && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5',
                        color: isDarkMode ? '#6ee7b7' : '#047857',
                        borderColor: isDarkMode ? '#047857' : '#a7f3d0'
                      }}
                    >
                      {overallCefrLevel}
                    </span>
                  )}
                </div>
                {overallLatestSkill && (
                  <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 capitalize">
                    {overallLatestSkill}
                  </div>
                )}
              </div>
            </div>

            {/* Vertical Divider */}
            <div
              className="hidden sm:block h-12 w-px"
              style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }}
            />

            {/* Widget 3: Study Streak */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.7)' : '#eff6ff',
                  color: '#2563eb'
                }}
              >
                <CalendarDays className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium" style={{ color: mutedColor }}>
                  Study Streak
                </div>
                <div className="text-xs font-extrabold" style={{ color: headingColor }}>
                  {unauthenticated ? '0 days' : `${studyStreakDays} ${studyStreakDays === 1 ? 'day' : 'days'}`}
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 2. 4 Skill Cards Grid */}
      <section aria-label="Skill Practice Cards" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {initialSkillCards.map((card) => (
          <SkillPracticeCard
            key={card.id}
            card={card}
            skillStats={stats?.skills?.[card.id]}
            isLoading={loading}
            selectedPart={selectedParts[card.id] || card.defaultPart}
            onPartChange={(part) => handlePartChange(card.id, part)}
            selectedMode={selectedModes[card.id] || card.defaultMode}
            onModeChange={(mode) => handleModeChange(card.id, mode)}
            onStart={handleStartPractice}
            isDarkMode={isDarkMode}
          />
        ))}
      </section>

    </div>
  );
};

export default Dashboard;
