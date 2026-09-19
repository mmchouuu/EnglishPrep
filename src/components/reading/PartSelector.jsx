import React from 'react';

const defaultReadingParts = [
  { id: '1', label: 'Part 1', sublabel: 'Sentence Comprehension' },
  { id: '2-3', label: 'Part 2–3', sublabel: 'Text Cohesion' },
  { id: '4', label: 'Part 4', sublabel: 'Opinion Matching' },
  { id: '5', label: 'Part 5', sublabel: 'Long Text Comprehension' }
];

export const PartSelector = ({ parts = defaultReadingParts, selectedPart, onSelectPart, isDarkMode = false }) => {
  return (
    <div
      role="tablist"
      aria-label="Module Parts"
      className={`grid grid-cols-2 md:grid-cols-4 rounded-xl border overflow-hidden transition-all ${
        isDarkMode
          ? 'bg-[#111827] border-[#29364a] shadow-xs'
          : 'bg-white border-[#dbe4f0] shadow-2xs'
      }`}
    >
      {parts.map((p) => {
        const isActive = String(selectedPart) === String(p.id);
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectPart(p.id)}
            className={`py-2 px-3 md:py-2.5 md:px-4 text-center transition-all border-r last:border-r-0 focus:outline-none ${
              isDarkMode ? 'border-slate-800' : 'border-slate-200'
            } ${
              isActive
                ? 'bg-[#2563eb] text-white font-bold shadow-xs'
                : isDarkMode
                  ? 'bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'bg-white text-[#334155] hover:text-[#0f172a] hover:bg-slate-50'
            }`}
          >
            <div className="text-xs md:text-sm font-extrabold tracking-tight">
              {p.label}
            </div>
            <div
              className={`text-[10px] md:text-[11px] font-medium leading-tight ${
                isActive ? 'text-blue-100' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {p.sublabel}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PartSelector;

