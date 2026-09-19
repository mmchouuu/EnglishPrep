import React from 'react';
import { ListChecks, Send, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Shared Navigator Action Buttons Component
 * Reused across Reading, Listening, Writing, and Speaking practice navigators.
 * Standardizes Flagged/Submit buttons, Prev/Next navigation, and Scroll to Top button.
 */
export function NavigatorActionButtons({
  flaggedCount = 0,
  filterBookmarked = false,
  onToggleFilterBookmarked,
  onSubmitAll,
  onScrollToTop,
  showScrollToTop = false,
  submitLabel = 'Submit all',
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  isDarkMode = false
}) {
  return (
    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
      {/* Previous / Next Navigation Action Buttons */}
      {(onPrev || onNext) && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 shadow-2xs ${
              hasPrev
                ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 shadow-2xs ${
              hasNext
                ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-[#2563eb]'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {/* Flagged Filter / Review Button */}
        <button
          type="button"
          onClick={onToggleFilterBookmarked}
          className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 shadow-2xs bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 min-w-0"
          style={
            filterBookmarked
              ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b', color: '#d97706' }
              : {}
          }
        >
          <ListChecks className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Flagged ({flaggedCount})</span>
        </button>

        {/* Submit All Button */}
        <button
          type="button"
          onClick={onSubmitAll}
          className="flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center justify-center gap-1.5 border border-[#2563eb] min-w-0"
        >
          <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{submitLabel}</span>
        </button>
      </div>

      {/* Optional Scroll to top button */}
      {showScrollToTop && (
        <button
          type="button"
          onClick={onScrollToTop}
          className="w-full py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:bg-slate-200 dark:hover:bg-slate-700"
          style={{
            backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
            borderColor: isDarkMode ? '#334155' : '#cbd5e1',
            color: isDarkMode ? '#cbd5e1' : '#475569'
          }}
        >
          <ArrowUp className="w-3.5 h-3.5 text-[#2563eb]" aria-hidden="true" />
          <span>Scroll to top</span>
        </button>
      )}
    </div>
  );
}

export default NavigatorActionButtons;
