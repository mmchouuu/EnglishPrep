import React, { useState, useEffect, useMemo, useRef } from 'react';
import BookmarkButton from './BookmarkButton';
import TopicHeaderBanner from './TopicHeaderBanner';
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Single Topic Set Component for Part 5 Long Text Comprehension
 */
function HeadingMatchingTopicSet({
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
  const headingOptions = setObj.headingOptions || [];
  const initialSections = setObj.sections || [];
  const topicName = setObj.topicName || `TOPIC ${setIndex + 1}`;
  const firedConfettiRef = useRef(new Set());

  const [sections, setSections] = useState(initialSections);

  useEffect(() => {
    setSections(setObj.sections || []);
  }, [setObj.sections]);

  const isSetChecking = sections.some((sec) => checkingQuestions?.[sec.id]);

  // Check if entire topic set is 100% completed & correct
  useEffect(() => {
    if (!results || sections.length === 0) return;
    const answeredSections = sections.filter((sec) => userAnswers[sec.id]);
    if (answeredSections.length === 0) return;

    const allAnsweredValid = answeredSections.every((sec) => {
      const res = results[sec.id];
      return res?.status === 'completed' && typeof res?.isCorrect === 'boolean';
    });

    const allAnsweredCorrect = answeredSections.every((sec) => results[sec.id]?.isCorrect === true);

    if (allAnsweredValid && allAnsweredCorrect) {
      const setEvalHash = answeredSections.map((sec) => `${sec.id}:${results[sec.id]?.evaluationId}`).join('|');
      if (!firedConfettiRef.current.has(setEvalHash)) {
        firedConfettiRef.current.add(setEvalHash);
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      }
    }
  }, [results, sections, userAnswers]);

  const handleCheckTopic = () => {
    if (!onCheckQuestion) return;
    sections.forEach((sec) => {
      const selectedVal = userAnswers[sec.id];
      if (selectedVal && sec.id) {
        onCheckQuestion(sec.id, selectedVal);
      }
    });
  };

  return (
    <div id={`part5-topic-${setIndex}`} data-scroll-index={setIndex} className="space-y-6 scroll-mt-24">
      {/* Topic Header Banner for Topic */}
      <TopicHeaderBanner
        topicName={topicName}
        setInfo={`${sections.length} paragraphs`}
        isDarkMode={isDarkMode}
      />

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column: Paragraph select dropdowns (Span 5) */}
        <div
          className="lg:col-span-5 p-5 md:p-6 rounded-2xl border transition-all space-y-5 shadow-xs overflow-hidden"
          style={{
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
            color: isDarkMode ? '#ffffff' : '#0f172a'
          }}
        >
          {/* Paragraph Selectors List */}
          <div className="space-y-3.5">
            {sections.map((sec, idx) => {
              const secId = sec.id;
              const selectedVal = userAnswers[secId] || '';
              const result = results?.[secId];

              const hasValidServerResult =
                result?.status === 'completed' &&
                typeof result?.isCorrect === 'boolean' &&
                result?.correctAnswer !== null &&
                result?.correctAnswer !== undefined;

              const isChecking = !!checkingQuestions?.[secId];
              const checkError = checkErrors?.[secId];
              const showResult = submitted || hasValidServerResult;
              const isCorrect = hasValidServerResult ? result.isCorrect : null;

              const correctOption = hasValidServerResult && result?.correctAnswer
                ? headingOptions.find((h) => h.key === result.correctAnswer)
                : null;
              const correctLabel = correctOption ? correctOption.text : result?.correctAnswer;

              let selectBg = isDarkMode ? '#1e293b' : '#ffffff';
              let selectBorder = isDarkMode ? '#334155' : '#cbd5e1';
              let selectText = isDarkMode ? '#ffffff' : '#0f172a';

              if (hasValidServerResult) {
                if (isCorrect) {
                  selectBg = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5';
                  selectBorder = '#10b981';
                  selectText = isDarkMode ? '#6ee7b7' : '#047857';
                } else {
                  selectBg = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2';
                  selectBorder = '#ef4444';
                  selectText = isDarkMode ? '#fca5a5' : '#b91c1c';
                }
              }

              return (
                <div
                  key={secId || idx}
                  id={`part5-q-${secId}`}
                  className="flex flex-col gap-1 text-xs py-0.5 scroll-mt-24"
                >
                  <div className="flex items-center gap-3">
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

                    <span
                      className="font-bold shrink-0 min-w-[95px]"
                      style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                    >
                      Paragraph {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <select
                        disabled={showResult || isChecking}
                        value={selectedVal}
                        onChange={(e) => onSelectAnswer(secId, e.target.value)}
                        className="w-full max-w-full truncate px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        style={{
                          backgroundColor: selectBg,
                          borderColor: selectBorder,
                          color: selectText
                        }}
                      >
                        <option value="" style={{ color: '#64748b' }}>Select a heading</option>
                        {headingOptions.map((h) => (
                          <option
                            key={h.key}
                            value={h.key}
                            style={{
                              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                              color: isDarkMode ? '#ffffff' : '#0f172a'
                            }}
                          >
                            {h.text}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isChecking && (
                    <div className="pl-[125px] text-[11px] text-blue-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Checking...
                    </div>
                  )}

                  {checkError && (
                    <div className="pl-[125px] flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      <span>{checkError}</span>
                      <button
                        onClick={() => onCheckQuestion && selectedVal && onCheckQuestion(secId, selectedVal)}
                        className="ml-1 underline font-bold"
                      >
                        Retry check
                      </button>
                    </div>
                  )}

                  {hasValidServerResult && !isCorrect && correctLabel && (
                    <div className="pl-[125px] mt-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 truncate max-w-full">
                      ✓ Correct answer: {correctLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <BookmarkButton
              isBookmarked={!!bookmarks[`part5-${setObj.id}`]}
              onToggle={() => onToggleBookmark(`part5-${setObj.id}`)}
              label="Mark for Review"
              isDarkMode={isDarkMode}
            />

            <div className="flex items-center gap-2">
              <button
                disabled={isSetChecking}
                onClick={handleCheckTopic}
                aria-live="polite"
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-blue-500 text-[#2563eb] hover:bg-blue-50 transition-all flex items-center gap-1.5 disabled:opacity-50"
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

        {/* Right Column: Long Reading Passage Text (Span 7) */}
        <div
          className="lg:col-span-7 p-6 md:p-8 rounded-2xl border transition-all space-y-6 shadow-xs"
          style={{
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
          }}
        >
          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
            {sections.map((sec, idx) => (
              <div key={sec.id || idx} className="flex items-start gap-4">
                <span
                  className="w-7 h-7 rounded-lg font-extrabold text-sm flex items-center justify-center shrink-0 mt-0.5 border"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff',
                    borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe',
                    color: '#2563eb'
                  }}
                >
                  {idx + 1}
                </span>
                <p
                  className="text-sm leading-relaxed flex-1 font-semibold"
                  style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                >
                  {sec.text}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Part 5: Long Text Comprehension (Heading Matching)
 * Renders each topic set with its own Topic Header, heading selectors, and reading passage.
 */
export default function Part5LongTextComprehension({
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
    if (data.headingOptions && data.sections) {
      return [
        {
          id: 'p5-single-set',
          topicName: data.topicName || activeGroup?.name || 'SCIENCE & TECHNOLOGY',
          headingOptions: data.headingOptions,
          sections: data.sections
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

  const displayGroupName = activeGroup?.name || activeGroup?.group_key || 'Long Text Comprehension';

  if (topicSets.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        No long text comprehension questions available for Part 5.
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {displayTopicSets.map((setObj, idx) => (
        <HeadingMatchingTopicSet
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

