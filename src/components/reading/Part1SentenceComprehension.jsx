import React, { useEffect, useRef } from 'react';
import BookmarkButton from './BookmarkButton';
import { Check, CircleCheck, X, RefreshCw, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Part 1: Sentence Comprehension (Multiple Choice)
 * Connected to Server-Side Objective Grading API (Phase 2B2 & Phase 2B2.1)
 */
export default function Part1SentenceComprehension({
  questions = [],
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  checkingQuestions = {},
  checkErrors = {},
  onSelectOption,
  onToggleBookmark,
  onCheckQuestion,
  isDarkMode = false
}) {
  const firedConfettiRef = useRef(new Set());

  // Fire confetti ONCE per correct evaluation ID / response ID
  useEffect(() => {
    if (!results) return;
    Object.entries(results).forEach(([qId, res]) => {
      const isValidResult =
        res?.status === 'completed' &&
        typeof res?.isCorrect === 'boolean' &&
        res?.correctAnswer !== null &&
        res?.correctAnswer !== undefined;

      if (isValidResult && res.isCorrect === true) {
        const confettiKey = `${qId}:${res.evaluationId || res.responseId}`;
        if (!firedConfettiRef.current.has(confettiKey)) {
          firedConfettiRef.current.add(confettiKey);
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        }
      }
    });
  }, [results]);

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
        const result = results?.[qId];
        const isChecking = !!checkingQuestions?.[qId];
        const checkError = checkErrors?.[qId];

        const hasValidServerResult =
          result?.status === 'completed' &&
          typeof result?.isCorrect === 'boolean' &&
          result?.correctAnswer !== null &&
          result?.correctAnswer !== undefined;

        const showResult = submitted || hasValidServerResult;
        const isCorrect = hasValidServerResult ? result.isCorrect : null;
        const serverCorrectAnswer = hasValidServerResult ? result.correctAnswer : null;

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
                  disabled={!selectedOption || showResult || isChecking}
                  onClick={() => onCheckQuestion && onCheckQuestion(qId, selectedOption)}
                  aria-live="polite"
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    showResult
                      ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                      : isChecking
                        ? 'bg-blue-500 text-white cursor-wait opacity-80'
                        : selectedOption
                          ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/20'
                          : 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                  }`}
                >
                  {isChecking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{showResult ? 'Checked' : 'Check answer'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error banner on check failure */}
            {checkError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />
                  <span>{checkError}</span>
                </div>
                <button
                  onClick={() => onCheckQuestion && onCheckQuestion(qId, selectedOption)}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold text-[11px] hover:bg-rose-700 transition-colors shrink-0"
                >
                  Retry check
                </button>
              </div>
            )}

            {/* Options List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {q.options?.map((opt, optIdx) => {
                const optKey = typeof opt === 'object'
                  ? (opt.key || opt.option_key || opt.value || opt.id || String.fromCharCode(65 + optIdx))
                  : opt;
                const optText = typeof opt === 'object'
                  ? (opt.text || opt.content || opt.label || '')
                  : opt;
                const isSelected = selectedOption === optKey || selectedOption === optIdx;

                let cardBg = isDarkMode ? '#1e293b' : '#ffffff';
                let cardBorder = isDarkMode ? '#334155' : '#d8e2ef';
                let cardTextColor = isDarkMode ? '#e2e8f0' : '#172033';

                if (isSelected) {
                  cardBg = isDarkMode ? 'rgba(30, 58, 138, 0.6)' : '#eff6ff';
                  cardBorder = '#2563eb';
                  cardTextColor = isDarkMode ? '#ffffff' : '#0f172a';
                }

                if (hasValidServerResult && serverCorrectAnswer !== null) {
                  const correctKey = String(serverCorrectAnswer).toUpperCase();
                  const currentOptKey = String(optKey).toUpperCase();

                  if (currentOptKey === correctKey) {
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
                    disabled={showResult || isChecking}
                    onClick={() => onSelectOption(qId, optKey)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    style={{
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      color: cardTextColor,
                      fontWeight: isSelected ? 700 : 600
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      isSelected
                        ? (hasValidServerResult && !isCorrect ? 'border-rose-500 bg-rose-600 text-white' : 'border-blue-500 bg-[#2563eb] text-white')
                        : isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-400' : 'border-slate-400 bg-white text-slate-600'
                    }`}>
                      {isSelected ? (hasValidServerResult && !isCorrect ? <X className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" /> : <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />) : optKey}
                    </div>
                    <span className="font-extrabold text-xs" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>{optKey}</span>
                    <span className="flex-1 font-semibold">{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Post-submit explanation */}
            {hasValidServerResult && (
              <div
                aria-live="polite"
                className={`mt-4 p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                  isCorrect
                    ? isDarkMode ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : isDarkMode ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {isCorrect ? (
                  <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div>
                  <span className="font-bold mr-1.5">{isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                  {!isCorrect && (
                    <span className="font-semibold block sm:inline mt-0.5 sm:mt-0">
                      Correct answer: Option {String(serverCorrectAnswer).toUpperCase()}.{' '}
                    </span>
                  )}
                  {result.explanation || (isCorrect ? 'Great job!' : '')}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


