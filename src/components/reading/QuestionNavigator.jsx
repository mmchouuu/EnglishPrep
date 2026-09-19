import React, { useState } from 'react';
import { Clock3, Flag, Info, Send, Search, ListChecks } from 'lucide-react';
import NavigatorActionButtons from '../common/NavigatorActionButtons';

export default function QuestionNavigator({
  questions = [],
  currentIndex = 0,
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  onSelectQuestion,
  onSubmitAll,
  filterBookmarked = false,
  onToggleFilterBookmarked,
  isDarkMode = false
}) {
  const [jumpInput, setJumpInput] = useState('');

  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= questions.length) {
      onSelectQuestion(num - 1);
      setJumpInput('');
    }
  };

  const flaggedCount = Object.values(bookmarks).filter(Boolean).length;
  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = questions.length || 143;
  const progressPercent = Math.round((answeredCount / totalCount) * 100);

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-20">

      {/* Top Timer & Progress Bar Card */}
      <div
        className={`p-5 rounded-2xl border transition-all ${isDarkMode
          ? 'bg-[#111827] border-[#29364a] shadow-xl text-white'
          : 'bg-white border-[#dbe4f0] shadow-xs text-[#0f172a]'
          }`}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <Clock3 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-extrabold tracking-tight">00:00:00</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Time elapsed</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-[#2563eb] dark:text-blue-400">
              {answeredCount} / {totalCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {progressPercent}%
            </div>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-[#2563eb] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Navigator Main Card */}
      <div
        className={`p-5 rounded-2xl border transition-all space-y-4 ${isDarkMode
          ? 'bg-[#111827] border-[#29364a] shadow-xl text-white'
          : 'bg-white border-[#dbe4f0] shadow-xs text-[#0f172a]'
          }`}
      >

        {/* Title */}
        <h3 className="text-sm font-bold tracking-tight text-[#0f172a] dark:text-white">
          Questions 1 – 5
        </h3>

        {/* Jump to question input */}
        <form onSubmit={handleJump} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. 25"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className={`flex-1 px-3 py-1.5 rounded-xl text-xs border outline-none transition-all ${isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 shadow-inner'
                }`}
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1"
            >
              <Search className="w-3 h-3" aria-hidden="true" />
              <span>Go</span>
            </button>
          </div>
        </form>

        {/* Status Legend */}
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 pt-2 pb-2 border-y border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
            <span>Not answered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#2563eb]" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-rose-500 bg-rose-500/20" />
            <span>Flagged</span>
          </div>
        </div>

        {/* Question Grid Buttons */}
        <div className="grid grid-cols-7 gap-2 max-h-60 overflow-y-auto pr-1">
          {questions.map((q, idx) => {
            const qId = q.id || idx;
            const isAnswered = userAnswers[qId] !== undefined && userAnswers[qId] !== '';
            const isFlagged = !!bookmarks[qId];
            const isCurrent = currentIndex === idx;
            const isResult = submitted && results && results[qId] !== undefined;
            const isCorrect = isResult ? results[qId] : null;

            if (filterBookmarked && !isFlagged) return null;

            let btnStyle = isDarkMode
              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50';

            if (isAnswered) {
              btnStyle = 'bg-[#2563eb] text-white border-[#2563eb] font-bold';
            }

            if (isFlagged) {
              btnStyle = 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500 font-bold';
            }

            if (isResult) {
              btnStyle = isCorrect
                ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                : 'bg-rose-600 text-white border-rose-600 font-bold';
            }

            if (isCurrent && !isAnswered && !isFlagged && !isResult) {
              btnStyle = isDarkMode
                ? 'bg-slate-700 text-white border-slate-500 font-bold'
                : 'bg-[#e2e8f0] text-slate-900 border-slate-400 font-bold';
            }

            return (
              <button
                key={idx}
                onClick={() => onSelectQuestion(idx)}
                className={`w-9 h-9 rounded-xl text-xs font-bold border flex items-center justify-center transition-all focus:outline-none hover:scale-105 shadow-2xs ${btnStyle}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Refactored Reusable NavigatorActionButtons Component */}
        <NavigatorActionButtons
          flaggedCount={flaggedCount}
          filterBookmarked={filterBookmarked}
          onToggleFilterBookmarked={onToggleFilterBookmarked}
          onSubmitAll={onSubmitAll}
          isDarkMode={isDarkMode}
        />

        {/* Helpful Info Tip */}
        <div className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2.5 ${isDarkMode ? 'bg-blue-950/40 border-blue-800/60 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>You can check each set as you go, flag questions for review, and submit all answers when finished.</span>
        </div>

      </div>
    </aside>
  );
}
