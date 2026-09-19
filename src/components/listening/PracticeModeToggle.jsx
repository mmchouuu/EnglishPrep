import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, CheckCircle2, SlidersHorizontal, Award } from 'lucide-react';

export const PracticeModeToggle = ({ 
  mode = 'full', 
  onModeChange, 
  answeredCount = 0, 
  totalCount = 13,
  timeFormatted = '25:00',
  isDarkMode = false 
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleToggle = (newMode) => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', newMode);
    setSearchParams(params);
    if (onModeChange) onModeChange(newMode);
  };

  const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className={`rounded-2xl border p-3.5 px-6 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
      isDarkMode 
        ? 'bg-[#0f172a] border-slate-800 text-slate-100' 
        : 'bg-white border-[#cbd5e1]/60 text-[#0f172a] shadow-xs'
    }`}>
      
      {/* Left: Mode selector */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-[#2563eb]'}`}>
          <SlidersHorizontal className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          PRACTICE MODE:
        </span>
        <div className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200/50'
        }`}>
          <button
            onClick={() => handleToggle('full')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'full'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Full Test Mode
          </button>
          <button
            onClick={() => handleToggle('topic')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === 'topic'
                ? 'bg-[#2563eb] text-white shadow-xs'
                : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By Topic Mode
          </button>
        </div>
      </div>

      {/* Right: Progress & Timer */}
      <div className="flex items-center gap-5 w-full sm:w-auto justify-between sm:justify-end">
        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`text-xs font-bold block ${isDarkMode ? 'text-slate-200' : 'text-[#0f172a]'}`}>
              Progress: {answeredCount}/{totalCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">
              {pct}% Completed
            </span>
          </div>
          <div className="w-24 sm:w-28 h-2 bg-[#1e293b] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#2563eb] transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
          isDarkMode 
            ? 'bg-slate-900 border-slate-800 text-amber-400' 
            : 'bg-amber-50/90 border-amber-200/80 text-amber-800'
        }`}>
          <Clock className="w-4 h-4 text-amber-600" />
          <span>{timeFormatted}</span>
        </div>
      </div>

    </div>
  );
};
