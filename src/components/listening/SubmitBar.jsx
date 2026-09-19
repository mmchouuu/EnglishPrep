import React from 'react';
import { Bookmark, Send } from 'lucide-react';

export const SubmitBar = ({
  flaggedCount = 0,
  onReviewFlagged,
  onSubmitAll,
  isDarkMode = false
}) => {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 border-t py-3.5 px-6 sm:px-10 transition-colors backdrop-blur-md shadow-lg ${isDarkMode
        ? 'bg-[#0f172a]/95 border-slate-800 text-slate-100'
        : 'bg-white/95 border-slate-200/80 text-[#0f172a]'
      }`}>
      <div className="max-w-[1540px] mx-auto flex items-center justify-between gap-4">

        {/* Left: Flagged Button */}
        <button
          onClick={onReviewFlagged}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${flaggedCount > 0
              ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300'
              : isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                : 'bg-slate-100/90 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
        >
          <Bookmark className={`w-4 h-4 ${flaggedCount > 0 ? 'fill-amber-400 text-amber-500' : ''}`} />
          <span>Flagged ({flaggedCount})</span>
        </button>

        {/* Right: Submit All Answers Button */}
        <button
          onClick={onSubmitAll}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-600 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-blue-500/25 transition-all transform active:scale-95"
        >
          <Send className="w-4 h-4" />
          <span>Submit all</span>
        </button>

      </div>
    </div>
  );
};
