import React from 'react';
import {
  Headphones,
  FileText,
  PenLine,
  Mic,
  List,
  Tag,
  Users,
  BarChart3,
  ArrowRight
} from 'lucide-react';

const iconMap = {
  Headphones,
  FileText,
  PenLine,
  Mic,
  List,
  Tag,
  Users
};

export const SkillPracticeCard = ({
  card,
  skillStats,
  isLoading = false,
  selectedPart,
  onPartChange,
  selectedMode,
  onModeChange,
  onStart,
  isDarkMode = false
}) => {
  const IconComponent = iconMap[card.icon] || FileText;

  // Accent color tokens
  const accentStyles = {
    blue: {
      iconBg: isDarkMode ? '#1e3a8a' : '#eff6ff',
      iconColor: '#2563eb',
      durationBg: isDarkMode ? '#1e3a8a' : '#eff6ff',
      durationText: '#2563eb',
      durationBorder: isDarkMode ? '#1e40af' : '#bfdbfe',
      ringColor: '#2563eb'
    },
    emerald: {
      iconBg: isDarkMode ? '#064e3b' : '#ecfdf5',
      iconColor: '#10b981',
      durationBg: isDarkMode ? '#1e3a8a' : '#eff6ff',
      durationText: '#2563eb',
      durationBorder: isDarkMode ? '#1e40af' : '#bfdbfe',
      ringColor: '#10b981'
    },
    purple: {
      iconBg: isDarkMode ? '#4c1d95' : '#f5f3ff',
      iconColor: '#8b5cf6',
      durationBg: isDarkMode ? '#1e3a8a' : '#eff6ff',
      durationText: '#2563eb',
      durationBorder: isDarkMode ? '#1e40af' : '#bfdbfe',
      ringColor: '#8b5cf6'
    },
    orange: {
      iconBg: isDarkMode ? '#7c2d12' : '#fff7ed',
      iconColor: '#f97316',
      durationBg: isDarkMode ? '#1e3a8a' : '#eff6ff',
      durationText: '#2563eb',
      durationBorder: isDarkMode ? '#1e40af' : '#bfdbfe',
      ringColor: '#f97316'
    }
  };

  const style = accentStyles[card.accent] || accentStyles.blue;

  // Real stats extraction
  const progressPercent = skillStats?.progressPercent ?? 0;
  const completedParts = skillStats?.completedParts ?? 0;
  const totalParts = skillStats?.totalParts ?? 4;
  const latestScore = skillStats?.latestScore;
  const evaluationStatus = skillStats?.evaluationStatus;
  const cefrLevel = skillStats?.cefrLevel;

  // Latest Score Display Text
  let scoreDisplayText = 'No score yet';
  if (evaluationStatus === 'pending') {
    scoreDisplayText = 'Pending';
  } else if (latestScore !== null && latestScore !== undefined) {
    scoreDisplayText = `${latestScore}/100`;
  }

  // Progress SVG calculations
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Explicit text colors
  const titleColor = isDarkMode ? '#ffffff' : '#0f172a';
  const textColor = isDarkMode ? '#e2e8f0' : '#334155';
  const mutedColor = isDarkMode ? '#cbd5e1' : '#475569';
  const borderColor = isDarkMode ? '#29364a' : '#cbd5e1';

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border flex flex-col justify-between shadow-xs animate-pulse p-6 min-h-[280px]"
        style={{
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          borderColor: isDarkMode ? '#29364a' : '#dbe4f0'
        }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2">
                <div className="w-32 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-48 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            </div>
            <div className="w-16 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="h-px w-full bg-slate-200 dark:bg-slate-800" />
          <div className="flex justify-between items-center gap-4">
            <div className="w-36 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="w-36 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>
        <div className="pt-4 flex justify-between items-center">
          <div className="w-40 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="w-28 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-label={`${card.title} Card`}
      className="rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md"
      style={{
        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        borderColor: isDarkMode ? '#29364a' : '#dbe4f0'
      }}
    >
      <div className="p-6 space-y-5">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: style.iconBg,
                color: style.iconColor,
                borderColor: isDarkMode ? '#334155' : '#e2e8f0'
              }}
            >
              <IconComponent className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3
                className="text-xl font-bold tracking-tight"
                style={{ color: titleColor }}
              >
                {card.title}
              </h3>
              <p
                className="text-xs mt-1 leading-relaxed font-medium"
                style={{ color: mutedColor }}
              >
                {card.description}
              </p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-lg border whitespace-nowrap"
            style={{
              backgroundColor: style.durationBg,
              color: style.durationText,
              borderColor: style.durationBorder
            }}
          >
            {card.duration}
          </span>
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />

        {/* Controls Section (Select Part & Practice Mode) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Select Part */}
          <div className="space-y-1.5 w-full sm:w-auto">
            <span
              className="text-[11px] font-bold uppercase tracking-wider block"
              style={{ color: mutedColor }}
            >
              SELECT PART
            </span>
            <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Select Part">
              {card.parts.map((part) => {
                const isActive = selectedPart === part;
                return (
                  <button
                    key={part}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onPartChange(part)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: isActive ? (isDarkMode ? 'rgba(30, 58, 138, 0.8)' : '#eff6ff') : (isDarkMode ? '#1e293b' : '#ffffff'),
                      color: isActive ? '#2563eb' : textColor,
                      borderColor: isActive ? '#2563eb' : borderColor,
                      fontWeight: isActive ? 700 : 600
                    }}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Separator on desktop */}
          <div className="hidden sm:block h-10 w-px" style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />

          {/* Practice Mode */}
          <div className="space-y-1.5 w-full sm:w-auto">
            <span
              className="text-[11px] font-bold uppercase tracking-wider block"
              style={{ color: mutedColor }}
            >
              PRACTICE MODE
            </span>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Practice Mode">
              {card.modes.map((mode) => {
                const ModeIcon = iconMap[mode.icon] || List;
                const isActive = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onModeChange(mode.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: isActive ? (isDarkMode ? 'rgba(30, 58, 138, 0.8)' : '#eff6ff') : (isDarkMode ? '#1e293b' : '#ffffff'),
                      color: isActive ? '#2563eb' : textColor,
                      borderColor: isActive ? '#2563eb' : borderColor,
                      fontWeight: isActive ? 700 : 600
                    }}
                  >
                    <ModeIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />
      </div>

      {/* Footer Section */}
      <div className="px-6 pb-6 pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Progress & Latest Score */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Progress ring & text */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
              <svg className="w-11 h-11 transform -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
                <circle
                  cx="22"
                  cy="22"
                  r={radius}
                  stroke={isDarkMode ? '#334155' : '#cbd5e1'}
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <circle
                  cx="22"
                  cy="22"
                  r={radius}
                  stroke={style.ringColor}
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-[10px] font-extrabold" style={{ color: titleColor }}>
                {progressPercent}%
              </span>
            </div>
            <div>
              <div className="text-[11px] font-bold" style={{ color: titleColor }}>
                Progress
              </div>
              <div
                className="text-[11px] font-medium"
                style={{ color: mutedColor }}
                aria-label={`${completedParts} of ${totalParts} parts completed`}
              >
                {completedParts} of {totalParts} parts completed
              </div>
            </div>
          </div>

          <div className="h-8 w-px hidden sm:block" style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />

          {/* Latest Score */}
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                color: '#2563eb'
              }}
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[10px] font-medium" style={{ color: mutedColor }}>Latest Score</div>
              <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: titleColor }}>
                <span>{scoreDisplayText}</span>
                {cefrLevel && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border"
                    style={{
                      backgroundColor: isDarkMode ? '#064e3b' : '#d1fae5',
                      color: isDarkMode ? '#6ee7b7' : '#047857',
                      borderColor: isDarkMode ? '#047857' : '#a7f3d0'
                    }}
                  >
                    {cefrLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Start Practice button */}
        <button
          onClick={() => onStart(card.id, selectedPart, selectedMode)}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <span>Start Practice</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default SkillPracticeCard;
