import React from 'react';
import { Bookmark, Flag } from 'lucide-react';

export const BookmarkButton = ({ isBookmarked, onToggle, label = 'Mark', isDarkMode }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
        isBookmarked
          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 shadow-xs'
          : isDarkMode
            ? 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
            : 'bg-white text-slate-700 hover:text-slate-900 border-slate-300 hover:bg-slate-50 shadow-xs'
      }`}
    >
      {isBookmarked ? (
        <Flag className="w-3.5 h-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
      ) : (
        <Bookmark className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
      )}
      <span>{isBookmarked ? 'Flagged' : label}</span>
    </button>
  );
};

export default BookmarkButton;
