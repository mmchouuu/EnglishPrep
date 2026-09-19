import React, { useState } from 'react';
import BookmarkButton from './BookmarkButton';
import { Check, CircleCheck, X } from 'lucide-react';

/**
 * Part 1: Sentence Comprehension (Multiple Choice)
 * Directly matching reading-p1.png reference screenshot.
 */
export default function Part1SentenceComprehension({
  questions = [],
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  onSelectOption,
  onToggleBookmark,
  isDarkMode = false
}) {
  const [checkedAnswers, setCheckedAnswers] = useState({});

  const handleCheckIndividual = (qId) => {
    setCheckedAnswers((prev) => ({ ...prev, [qId]: true }));
  };

  if (!questions || questions.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        No questions available for Part 1.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const qId = q.id || idx;
        const selectedOption = userAnswers[qId];
        const isBookmarked = !!bookmarks[qId];
        const isCheckedLocally = checkedAnswers[qId];
        const showResult = submitted || isCheckedLocally;
        
        const isResult = results && results[qId] !== undefined;
        const isCorrect = showResult ? (isResult ? results[qId] : selectedOption === q.correctAnswer) : null;

        return (
          <div
            key={qId}
            id={`question-${qId}`}
            data-scroll-index={idx}
            className="rounded-2xl p-4 sm:p-5 border transition-all scroll-mt-24"
            style={{
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
              borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
            }}
          >
            {/* Top row: Number badge, Prompt, and Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 flex-1">
                <span
                  className="w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff',
                    borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe',
                    color: '#2563eb'
                  }}
                >
                  {idx + 1}
                </span>
                <div
                  className="text-xs sm:text-sm font-bold leading-relaxed"
                  style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}
                >
                  {q.prompt || q.content}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                <BookmarkButton
                  isBookmarked={isBookmarked}
                  onToggle={() => onToggleBookmark(qId)}
                  isDarkMode={isDarkMode}
                />
                
                <button
                  disabled={!selectedOption || showResult}
                  onClick={() => handleCheckIndividual(qId)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    showResult
                      ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                      : selectedOption
                        ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/20'
                        : 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Check answer</span>
                </button>
              </div>
            </div>

            {/* Options List (Radio card layout matching reference screenshot) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {q.options?.map((opt, optIdx) => {
                const optKey = typeof opt === 'object' ? opt.key || opt.value || opt.text : opt;
                const optText = typeof opt === 'object' ? opt.text : opt;
                const isSelected = selectedOption === optKey;

                let cardBg = isDarkMode ? '#1e293b' : '#ffffff';
                let cardBorder = isDarkMode ? '#334155' : '#d8e2ef';
                let cardTextColor = isDarkMode ? '#e2e8f0' : '#172033';

                if (isSelected) {
                  cardBg = isDarkMode ? 'rgba(30, 58, 138, 0.6)' : '#eff6ff';
                  cardBorder = '#2563eb';
                  cardTextColor = isDarkMode ? '#ffffff' : '#0f172a';
                }

                if (showResult) {
                  if (optKey === q.correctAnswer) {
                    cardBg = 'rgba(16, 185, 129, 0.15)';
                    cardBorder = '#10b981';
                    cardTextColor = isDarkMode ? '#6ee7b7' : '#047857';
                  } else if (isSelected && !isCorrect) {
                    cardBg = 'rgba(239, 68, 68, 0.15)';
                    cardBorder = '#ef4444';
                    cardTextColor = isDarkMode ? '#fca5a5' : '#b91c1c';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    disabled={showResult}
                    onClick={() => onSelectOption(qId, optKey)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      color: cardTextColor,
                      fontWeight: isSelected ? 700 : 600
                    }}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      isSelected
                        ? 'border-blue-500 bg-[#2563eb] text-white'
                        : isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-400' : 'border-slate-400 bg-white text-slate-600'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />}
                    </div>
                    <span className="font-extrabold text-xs" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>{optKey}</span>
                    <span className="flex-1 font-semibold">{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Post-submit explanation */}
            {showResult && (
              <div className={`mt-4 p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                isCorrect
                  ? isDarkMode ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : isDarkMode ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {isCorrect ? (
                  <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div>
                  <span className="font-bold mr-1.5">{isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                  {q.explanation || (isCorrect ? 'Great job!' : `Correct answer is Option ${q.correctAnswer}.`)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
