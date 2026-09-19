import React, { useState } from 'react';
import { Flag, Search } from 'lucide-react';
import ReadingTimerProgressWidget from './ReadingTimerProgressWidget';
import NavigatorActionButtons from '../common/NavigatorActionButtons';

/**
 * Part 1 Question Navigator
 * Dynamic question buttons from DB, smooth scrolling to question cards,
 * with shared NavigatorActionButtons component.
 */
export default function Part1QuestionNavigator({
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

  const totalCount = questions.length || 143;

  const scrollToQuestion = (idx) => {
    onSelectQuestion(idx);
    const qObj = questions[idx];
    const qId = qObj ? qObj.id : `q-${idx}`;
    const el = document.getElementById(`question-${qId}`) || document.getElementById(`part1-q-${idx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalCount) {
      scrollToQuestion(num - 1);
      setJumpInput('');
    }
  };

  const flaggedCount = Object.values(bookmarks).filter(Boolean).length;
  const answeredCount = Object.keys(userAnswers).length;

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-3 lg:sticky lg:top-20">
      {/* Top Timer & Progress Widget */}
      <ReadingTimerProgressWidget
        timeStr="00:00:00"
        answeredCount={answeredCount}
        totalCount={totalCount}
        isDarkMode={isDarkMode}
      />

      {/* Main Sidebar Card with Flex Column Layout */}
      <div
        className="p-4 sm:p-5 rounded-2xl border transition-all flex flex-col max-h-[calc(100vh-10rem)] shadow-xs space-y-3 overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
          color: isDarkMode ? '#ffffff' : '#0f172a'
        }}
      >
        {/* Header (Shrink-0) */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h3
            className="text-sm sm:text-base font-extrabold tracking-tight"
            style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}
          >
            Questions 1 – {totalCount}
          </h3>
        </div>

        {/* Jump to question input (Shrink-0) */}
        <form onSubmit={handleJump} className="space-y-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="e.g. 25"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border outline-none transition-all focus:border-blue-500"
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                color: isDarkMode ? '#ffffff' : '#0f172a'
              }}
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1 shrink-0"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Go</span>
            </button>
          </div>
        </form>

        {/* Status Legend (Shrink-0) */}
        <div
          className="flex items-center justify-between text-[11px] font-semibold py-1.5 border-y shrink-0"
          style={{
            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
            color: isDarkMode ? '#cbd5e1' : '#334155'
          }}
        >
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded border"
              style={{
                borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff'
              }}
            />
            <span>Not answered</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#2563eb]" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded border border-rose-500 bg-rose-500/20" />
            <span>Flagged</span>
          </div>
        </div>

        {/* Question Grid Buttons */}
        <div className="grid grid-cols-7 gap-1.5 flex-1 overflow-y-auto pr-1 min-h-[140px] max-h-[280px]">
          {Array.from({ length: totalCount }).map((_, idx) => {
            const qObj = questions[idx];
            const qId = qObj ? qObj.id : `q-${idx}`;
            const isAnswered = userAnswers[qId] !== undefined && userAnswers[qId] !== '';
            const isFlagged = !!bookmarks[qId];
            const isCurrent = currentIndex === idx;
            const isResult = submitted && results && results[qId] !== undefined;
            const isCorrect = isResult ? results[qId] : null;

            if (filterBookmarked && !isFlagged) return null;

            let btnBg = isDarkMode ? '#1e293b' : '#ffffff';
            let btnBorder = isDarkMode ? '#334155' : '#d8e2ef';
            let btnTextColor = isDarkMode ? '#cbd5e1' : '#0f172a';

            if (isAnswered) {
              btnBg = '#2563eb';
              btnBorder = '#2563eb';
              btnTextColor = '#ffffff';
            }

            if (isFlagged) {
              btnBg = 'rgba(244, 63, 94, 0.15)';
              btnBorder = '#f43f5e';
              btnTextColor = isDarkMode ? '#fda4af' : '#e11d48';
            }

            if (isResult) {
              btnBg = isCorrect ? '#059669' : '#dc2626';
              btnBorder = isCorrect ? '#059669' : '#dc2626';
              btnTextColor = '#ffffff';
            }

            if (isCurrent && !isAnswered && !isFlagged && !isResult) {
              btnBg = isDarkMode ? '#334155' : '#e2e8f0';
              btnBorder = isDarkMode ? '#64748b' : '#94a3b8';
              btnTextColor = isDarkMode ? '#ffffff' : '#0f172a';
            }

            return (
              <button
                key={idx}
                onClick={() => scrollToQuestion(idx)}
                className="w-9 h-9 rounded-xl text-xs font-bold border flex items-center justify-center transition-all focus:outline-none min-w-0 hover:scale-105 shadow-2xs"
                style={{
                  backgroundColor: btnBg,
                  borderColor: btnBorder,
                  color: btnTextColor
                }}
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
      </div>
    </aside>
  );
}
