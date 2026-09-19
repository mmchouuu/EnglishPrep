import React, { useState, useMemo } from 'react';
import BookmarkButton from './BookmarkButton';
import TopicHeaderBanner from './TopicHeaderBanner';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

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
  onSelectAnswer,
  onToggleBookmark,
  isDarkMode = false
}) {
  const persons = setObj.persons || [];
  const questions = setObj.questions || [];
  const topicName = setObj.topicName || `TOPIC ${setIndex + 1}`;

  const [checkedSet, setCheckedSet] = useState(false);
  const showResult = submitted || checkedSet;

  const personBadgeStyles = {
    A: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    B: { bg: '#ecfdf5', color: '#10b981', border: '#a7f3d0' },
    C: { bg: '#f5f3ff', color: '#8b5cf6', border: '#ddd6fe' },
    D: { bg: '#fff7ed', color: '#f97316', border: '#fed7aa' }
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
              const isCorrect = showResult ? (results ? results[qId] : selectedVal === q.correctPerson) : null;

              let rowBg = isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc';
              let rowBorder = isDarkMode ? '#334155' : '#e2e8f0';

              if (showResult) {
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
                    <span
                      className="text-xs font-semibold leading-relaxed"
                      style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                    >
                      {q.text}
                    </span>
                  </div>

                  <select
                    disabled={showResult}
                    value={selectedVal}
                    onChange={(e) => onSelectAnswer(qId, e.target.value)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                onClick={() => setCheckedSet(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-blue-500 text-[#2563eb] hover:bg-blue-50 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Check this topic</span>
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
