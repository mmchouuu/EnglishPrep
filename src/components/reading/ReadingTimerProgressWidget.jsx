import React from 'react';
import { Clock } from 'lucide-react';

/**
 * Shared Timer & Progress Widget Component
 * Directly matching reference Hình 3.
 */
export default function ReadingTimerProgressWidget({
  timeStr = '00:00:00',
  answeredCount = 0,
  totalCount = 143,
  isDarkMode = false
}) {
  const percent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div
      className="p-3.5 px-4 rounded-2xl border transition-all shadow-2xs flex items-center justify-between gap-4"
      style={{
        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
        color: isDarkMode ? '#ffffff' : '#0f172a'
      }}
    >
      {/* Left: Clock Icon & Timer */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0"
          style={{
            borderColor: isDarkMode ? '#334155' : '#cbd5e1',
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
            color: isDarkMode ? '#94a3b8' : '#475569'
          }}
        >
          <Clock className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <div className="text-[11px] font-semibold" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Timer
          </div>
          <div className="text-sm font-extrabold tracking-tight" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            {timeStr}
          </div>
        </div>
      </div>

      {/* Vertical Line Divider */}
      <div
        className="h-8 w-px shrink-0"
        style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }}
      />

      {/* Right: Progress Label, Mini Bar & Count */}
      <div className="flex flex-col justify-center gap-1 min-w-[95px] flex-1 max-w-[130px]">
        <div className="text-[11px] font-semibold" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Progress
        </div>
        {/* Progress Bar */}
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}
        >
          <div
            className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="text-[11px] font-bold text-right" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
          {answeredCount} / {totalCount}
        </div>
      </div>
    </div>
  );
}
