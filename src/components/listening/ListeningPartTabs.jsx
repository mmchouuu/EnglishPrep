import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';

export const ListeningPartTabs = ({ activePart, isDarkMode = false }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentMode = searchParams.get('mode') || 'full';

  const parts = [
    { id: 1, path: 'part-1', title: 'Part 1', sub: 'Information Recognition' },
    { id: 2, path: 'part-2', title: 'Part 2', sub: 'Information Matching' },
    { id: 3, path: 'part-3', title: 'Part 3', sub: 'Opinion Matching' },
    { id: 4, path: 'part-4', title: 'Part 4', sub: 'Longer Monologues' }
  ];

  const handleTabClick = (partItem) => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', currentMode);
    
    if (partItem.id === 1) {
      params.set('question', '1');
    } else {
      params.set('set', '1');
    }

    navigate(`/listening/${partItem.path}?${params.toString()}`);
  };

  const handleModeToggle = (newMode) => {
    const params = new URLSearchParams(searchParams);
    params.set('mode', newMode);
    setSearchParams(params);
  };

  return (
    <div className={`rounded-2xl border p-2 transition-all shadow-xs ${
      isDarkMode 
        ? 'bg-[#0f172a] border-slate-800' 
        : 'bg-white border-[#cbd5e1]/60'
    }`}>
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        
        {/* 4 Main Part Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 w-full lg:w-auto flex-1">
          {parts.map((p) => {
            const isActive = Number(activePart) === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleTabClick(p)}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all text-center flex flex-col items-center justify-center ${
                  isActive
                    ? 'bg-[#2563eb] text-white shadow-xs'
                    : isDarkMode
                      ? 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="font-extrabold">{p.title}</span>
                <span className={`text-[11px] font-medium leading-tight ${
                  isActive ? 'text-white/90' : isDarkMode ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  {p.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side: Practice Mode & Timer & Progress */}
        <div className="flex items-center gap-3 px-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800 pt-2 lg:pt-0">
          
          {/* Mode Switcher */}
          <div className={`flex items-center p-1 rounded-xl border text-xs font-semibold ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200/50'
          }`}>
            <button
              onClick={() => handleModeToggle('full')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                currentMode === 'full'
                  ? 'bg-[#2563eb] text-white shadow-xs'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Practice
            </button>
            <button
              onClick={() => handleModeToggle('topic')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                currentMode === 'topic'
                  ? 'bg-[#2563eb] text-white shadow-xs'
                  : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Topic
            </button>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            isDarkMode 
              ? 'bg-slate-900 border-slate-800 text-blue-400' 
              : 'bg-blue-50/70 border-blue-200/60 text-[#2563eb]'
          }`}>
            <Clock className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>20 mins</span>
          </div>

          {/* Progress */}
          <div className="text-right hidden sm:block">
            <span className={`text-[11px] font-bold block ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              0% complete
            </span>
            <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
              <div className="h-full bg-[#2563eb] rounded-full w-0" />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
