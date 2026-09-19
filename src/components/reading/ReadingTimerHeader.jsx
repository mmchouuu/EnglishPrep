import React from 'react';
import { Clock3 } from 'lucide-react';

/**
 * Shared Header Timer & Progress Widget for Reading Practice
 * Used across Part 1, Part 2–3, Part 4, and Part 5.
 */
export default function ReadingTimerHeader({
  timeString = '00:00:00',
  answeredCount = 0,
  totalCount = 143,
  isDarkMode = false
}) {
  const percent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div
      className="flex items-center gap-4 p-2.5 px-4 rounded-xl border text-xs shadow-xs transition-colors"
      style={{
        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
        color: isDarkMode ? '#ffffff' : '#0f172a'
      }}
    >
      {/* Clock Icon & Time */}
      <div className="flex items-center gap-2">
        <Clock3 className="w-4 h-4 text-[#2563eb] shrink-0" aria-hidden="true" />
        <div>
          <div className="font-extrabold text-sm leading-none" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            {timeString}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
            Time elapsed
          </div>
        </div>
      </div>

      {/* Vertical Divider */}
      <div className="h-6 w-px" style={{ backgroundColor: isDarkMode ? '#334155' : '#e2e8f0' }} />

      {/* Progress Counter & Bar */}
      <div>
        <div className="font-bold text-[#2563eb] text-right">
          {answeredCount} / {totalCount}
        </div>
        <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-0.5 overflow-hidden">
          <div
            className="h-full bg-[#2563eb] transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
