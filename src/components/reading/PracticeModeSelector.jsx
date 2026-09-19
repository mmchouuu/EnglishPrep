import React from 'react';
import { List, Tag } from 'lucide-react';

export const PracticeModeSelector = ({
  selectedPart,
  selectedMode = 'full',
  onSelectMode,
  hasTopics = true,
  isDarkMode = false
}) => {
  if (!hasTopics) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="tablist"
        aria-label="Practice Mode"
        className={`flex items-center p-1 rounded-xl border transition-all ${
          isDarkMode ? 'bg-[#111827] border-[#29364a]' : 'bg-slate-100 border-[#cbd5e1]'
        }`}
      >
        <button
          role="tab"
          aria-selected={selectedMode === 'full'}
          onClick={() => onSelectMode('full')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            selectedMode === 'full'
              ? 'bg-[#2563eb] text-white shadow-xs font-bold'
              : isDarkMode
                ? 'text-slate-300 hover:text-white'
                : 'text-[#334155] hover:text-[#0f172a]'
          }`}
        >
          <List className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Full Practice</span>
        </button>

        <button
          role="tab"
          aria-selected={selectedMode === 'topic'}
          disabled={!hasTopics}
          onClick={() => hasTopics && onSelectMode('topic')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            selectedMode === 'topic'
              ? 'bg-[#2563eb] text-white shadow-xs font-bold'
              : !hasTopics
                ? 'opacity-50 cursor-not-allowed text-slate-400'
                : isDarkMode
                  ? 'text-slate-300 hover:text-white'
                  : 'text-[#334155] hover:text-[#0f172a]'
          }`}
        >
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          <span>By Topic</span>
        </button>
      </div>

      {!hasTopics && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1">
          No topics available
        </span>
      )}
    </div>
  );
};

export default PracticeModeSelector;
