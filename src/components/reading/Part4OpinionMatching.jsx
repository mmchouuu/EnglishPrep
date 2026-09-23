import React, { useState, useMemo, useEffect, useRef } from 'react';
import BookmarkButton from './BookmarkButton';
import TopicHeaderBanner from './TopicHeaderBanner';
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Single Topic Set Card Component for Part 4 Opinion Matching
 */
function OpinionMatchingTopicSet({
  setObj = {},
  setIndex = 0,
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  checkingQuestions = null,
  checkErrors = null,
  onCheckQuestion,
  onSelectAnswer,
  onToggleBookmark,
  isDarkMode = false
}) {
  const persons = setObj.persons || [];
  const questions = setObj.questions || [];
  const topicName = setObj.topicName || `TOPIC ${setIndex + 1}`;
  const firedConfettiRef = useRef(new Set());

  const isSetChecking = questions.some((q) => checkingQuestions?.[q.id]);

  // Check if entire topic set is 100% completed & correct
  useEffect(() => {
    if (!results || questions.length === 0) return;
    const answeredQuestions = questions.filter((q) => userAnswers[q.id]);
    if (answeredQuestions.length === 0) return;

    const allAnsweredValid = answeredQuestions.every((q) => {
      const res = results[q.id];
      return res?.status === 'completed' && typeof res?.isCorrect === 'boolean';
    });

    const allAnsweredCorrect = answeredQuestions.every((q) => results[q.id]?.isCorrect === true);

    if (allAnsweredValid && allAnsweredCorrect) {
      const setEvalHash = answeredQuestions.map((q) => `${q.id}:${results[q.id]?.evaluationId}`).join('|');
      if (!firedConfettiRef.current.has(setEvalHash)) {
        firedConfettiRef.current.add(setEvalHash);
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      }
    }
  }, [results, questions, userAnswers]);

  const personBadgeStyles = {
    A: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    B: { bg: '#ecfdf5', color: '#10b981', border: '#a7f3d0' },
    C: { bg: '#f5f3ff', color: '#8b5cf6', border: '#ddd6fe' },
    D: { bg: '#fff7ed', color: '#f97316', border: '#fed7aa' }
  };

  const handleCheckTopic = () => {
    if (!onCheckQuestion) return;
    questions.forEach((q) => {
      const selectedVal = userAnswers[q.id];
      if (selectedVal && q.id) {
        onCheckQuestion(q.id, selectedVal);
      }
    });
  };

  return (
    <div id={`part4-topic-${setIndex}`} data-scroll-index={setIndex} className="space-y-6 scroll-mt-24">
      {/* Topic Header Banner */}
      <TopicHeaderBanner
        topicName={topicName}
        setInfo={`${questions.length} questions`}
        isDarkMode={isDarkMode}
      />

      {/* 2-Panel Main Area: Left Separate Person Cards, Right Matching Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column: Individual Person Cards A, B, C, D (Span 6) */}
        <div className="lg:col-span-6 space-y-4">
          {persons.map((p) => {
            const badge = personBadgeStyles[p.key] || personBadgeStyles.A;
            return (
              <div
                key={p.key}
                className="p-5 rounded-2xl border transition-all space-y-2 shadow-2xs"
                style={{
                  backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                  borderColor: isDarkMode ? '#29364a' : '#e2e8f0'
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-7 h-7 rounded-full font-extrabold flex items-center justify-center text-xs shrink-0 border"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : badge.bg,
                      borderColor: isDarkMode ? '#1e3a8a' : badge.border,
                      color: badge.color
                    }}
                  >
                    {p.key}
                  </span>
                  <h4
                    className="text-sm font-extrabold"
                    style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}
                  >
                    {p.name.includes('—') ? p.name : (p.name.startsWith(`Person ${p.key}`) ? p.name : `Person ${p.key} — ${p.name}`)}
                  </h4>
                </div>
                <p
                  className="text-xs leading-relaxed font-semibold pl-10"
                  style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}
                >
                  {p.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: Statement Matching List Card (Span 6) */}
        <div
          className="lg:col-span-6 p-6 rounded-2xl border transition-all space-y-5 shadow-xs"
          style={{
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
            color: isDarkMode ? '#ffffff' : '#0f172a'
          }}
        >
          <div className="space-y-3">
            {questions.map((q, idx) => {
              const qId = q.id;
              const selectedVal = userAnswers[qId] || '';
              const result = results?.[qId];

              const hasValidServerResult =
                result?.status === 'completed' &&
                typeof result?.isCorrect === 'boolean' &&
                result?.correctAnswer !== null &&
                result?.correctAnswer !== undefined;

              const isChecking = !!checkingQuestions?.[qId];
              const checkError = checkErrors?.[qId];
              const showResult = submitted || hasValidServerResult;
              const isCorrect = hasValidServerResult ? result.isCorrect : null;

              let rowBg = isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc';
              let rowBorder = isDarkMode ? '#334155' : '#e2e8f0';

              const correctPersonVal = result?.correctAnswer || q.correctAnswer || q.answer;

              if (hasValidServerResult) {
                if (isCorrect) {
                  rowBg = isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5';
                  rowBorder = '#10b981';
                } else {
                  rowBg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2';
                  rowBorder = '#ef4444';
                }
              }

              return (
                <div
                  key={qId}
                  id={`part4-q-${qId}`}
                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all scroll-mt-24"
                  style={{
                    backgroundColor: rowBg,
                    borderColor: rowBorder
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff',
                        borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe',
                        color: '#2563eb'
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <span
                        className="text-xs font-semibold leading-relaxed block"
                        style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                      >
                        {q.text}
                      </span>
                      {hasValidServerResult && !isCorrect && correctPersonVal && (
                        <div className="mt-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          ✓ Correct answer: Person {correctPersonVal}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <select
                      disabled={showResult || isChecking}
                      value={selectedVal}
                      onChange={(e) => onSelectAnswer(qId, e.target.value)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      style={{
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                        color: isDarkMode ? '#ffffff' : '#0f172a'
                      }}
                    >
                      <option value="" style={{ color: '#64748b' }}>Choose person</option>
                      {persons.map((p) => (
                        <option
                          key={p.key}
                          value={p.key}
                          style={{
                            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                            color: isDarkMode ? '#ffffff' : '#0f172a'
                          }}
                        >
                          Person {p.key}
                        </option>
                      ))}
                    </select>

                    {isChecking && (
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Checking...
                      </span>
                    )}

                    {checkError && (
                      <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        <span>{checkError}</span>
                        <button
                          onClick={() => onCheckQuestion && selectedVal && onCheckQuestion(qId, selectedVal)}
                          className="ml-1 underline font-bold"
                        >
                          Retry check
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <BookmarkButton
              isBookmarked={!!bookmarks[`part4-${setObj.id}`]}
              onToggle={() => onToggleBookmark(`part4-${setObj.id}`)}
              label="Mark for review"
              isDarkMode={isDarkMode}
            />

            <div className="flex items-center gap-3">
              <button
                disabled={isSetChecking}
                onClick={handleCheckTopic}
                aria-live="polite"
                className="px-4 py-2 rounded-xl text-xs font-bold border border-blue-500 text-[#2563eb] hover:bg-blue-50 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSetChecking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Check this topic</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Part 4: Opinion Matching
 * Supports rendering each topic set with its own topic banner, passage, and 7 questions.
 */
export default function Part4OpinionMatching({
  data = {},
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  checkingQuestions = null,
  checkErrors = null,
  onCheckQuestion,
  onSelectAnswer,
  onToggleBookmark,
  isDarkMode = false,
  mode = 'full',
  groups = [],
  activeGroup = null,
  onSelectGroup
}) {
  const topicSets = useMemo(() => {
    if (data.topicSets && data.topicSets.length > 0) {
      return data.topicSets;
    }
    if (data.persons && data.questions) {
      return [
        {
          id: 'p4-single-set',
          topicName: data.topicName || activeGroup?.name || 'HEALTHY LIFESTYLES',
          persons: data.persons,
          questions: data.questions
        }
      ];
    }
    return [];
  }, [data, activeGroup]);

  const currentGroupIdx = useMemo(() => {
    if (!groups || groups.length === 0) return 0;
    const activeKey = activeGroup?.group_key || activeGroup?.key;
    const idx = groups.findIndex((g) => g.group_key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [groups, activeGroup]);

  const displayTopicSets = useMemo(() => {
    if (mode === 'topic') {
      const idx = currentGroupIdx >= 0 && currentGroupIdx < topicSets.length ? currentGroupIdx : 0;
      return topicSets[idx] ? [topicSets[idx]] : (topicSets[0] ? [topicSets[0]] : []);
    }
    return topicSets;
  }, [mode, topicSets, currentGroupIdx]);

  const displayGroupName = activeGroup?.name || activeGroup?.group_key || 'Opinion Matching';

  if (topicSets.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        No opinion matching questions available for Part 4.
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {displayTopicSets.map((setObj, idx) => (
        <OpinionMatchingTopicSet
          key={setObj.id || idx}
          setObj={setObj}
          setIndex={idx}
          userAnswers={userAnswers}
          bookmarks={bookmarks}
          submitted={submitted}
          results={results}
          checkingQuestions={checkingQuestions}
          checkErrors={checkErrors}
          onCheckQuestion={onCheckQuestion}
          onSelectAnswer={onSelectAnswer}
          onToggleBookmark={onToggleBookmark}
          isDarkMode={isDarkMode}
        />
      ))}

      {/* Group Navigation Bar (< and >) in whitespace below question container ONLY when in topic mode */}
      {mode === 'topic' && groups && groups.length > 0 && (
        <div className="flex items-center justify-between pt-4 px-1">
          <button
            type="button"
            onClick={() => {
              if (currentGroupIdx > 0 && groups[currentGroupIdx - 1] && onSelectGroup) {
                onSelectGroup(groups[currentGroupIdx - 1].group_key);
              }
            }}
            disabled={currentGroupIdx <= 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              currentGroupIdx > 0
                ? isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
            }`}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <span className="text-xs font-extrabold" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
            {displayGroupName} ({currentGroupIdx + 1} / {groups.length})
          </span>

          <button
            type="button"
            onClick={() => {
              if (currentGroupIdx < groups.length - 1 && groups[currentGroupIdx + 1] && onSelectGroup) {
                onSelectGroup(groups[currentGroupIdx + 1].group_key);
              }
            }}
            disabled={currentGroupIdx >= groups.length - 1}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              currentGroupIdx < groups.length - 1
                ? isDarkMode
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
            }`}
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

