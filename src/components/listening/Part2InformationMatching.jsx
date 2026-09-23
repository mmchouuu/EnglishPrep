import React, { useMemo, useEffect, useRef } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AudioPlayer } from './AudioPlayer';
import TopicHeaderBanner from '../reading/TopicHeaderBanner';

function cleanTopicTitle(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^Listening\s+Part\s+\d+:?\s*/i, '');
  str = str.replace(/^Listening\s+Practice\s+Set\s*\([^)]*\):?\s*/i, '');
  return str.trim();
}

export const Part2InformationMatching = ({
  sets = [],
  currentSetIndex = 0,
  userAnswers = {},
  onSelectOption,
  markedQuestions = {},
  onToggleMark,
  submitted = false,
  results = null,
  checkingQuestions = null,
  checkErrors = null,
  onCheckQuestion,
  onSelectSet,
  mode = 'full',
  isDarkMode = false,
  groups = [],
  activeGroup = null,
  onSelectGroup
}) => {
  const firedConfettiRef = useRef(new Set());

  const currentGroupIdx = useMemo(() => {
    if (!groups || groups.length === 0) return 0;
    const activeKey = activeGroup?.group_key || activeGroup?.key;
    const idx = groups.findIndex((g) => g.group_key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [groups, activeGroup]);

  const displayGroupName = cleanTopicTitle(activeGroup?.name || activeGroup?.group_key || sets[0]?.topic || 'Topic');

  if (!sets || sets.length === 0) return null;

  const setsToRender = mode === 'full'
    ? sets
    : [sets[currentSetIndex] || sets[0]];

  return (
    <div className="space-y-8">
      {setsToRender.map((currentSet, sIdx) => {
        const actualSetIdx = mode === 'full' ? sIdx : currentSetIndex;
        const items = currentSet.items || [];
        const isSetChecking = items.some((item) => checkingQuestions?.[item.id]);
        const isSetFlagged = markedQuestions[currentSet.id];
        const rawTopicName = currentSet.topic || currentSet.topicName || currentSet.title || 'INFORMATION MATCHING';
        const topicName = cleanTopicTitle(rawTopicName) || 'INFORMATION MATCHING';

        // Set-level confetti check
        useEffect(() => {
          if (!results || items.length === 0) return;
          const answeredItems = items.filter((item) => userAnswers[item.id]);
          if (answeredItems.length === 0) return;

          const allAnsweredValid = answeredItems.every((item) => {
            const res = results[item.id];
            return res?.status === 'completed' && typeof res?.isCorrect === 'boolean';
          });

          const allAnsweredCorrect = answeredItems.every((item) => results[item.id]?.isCorrect === true);

          if (allAnsweredValid && allAnsweredCorrect) {
            const setEvalHash = answeredItems.map((item) => `${item.id}:${results[item.id]?.evaluationId}`).join('|');
            if (!firedConfettiRef.current.has(setEvalHash)) {
              firedConfettiRef.current.add(setEvalHash);
              confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
            }
          }
        }, [results, items, userAnswers]);

        const handleCheckSet = () => {
          if (!onCheckQuestion) return;
          items.forEach((item) => {
            const val = userAnswers[item.id];
            if (val && item.id) {
              onCheckQuestion(item.id, val);
            }
          });
        };

        return (
          <div
            key={currentSet.id || sIdx}
            id={`set-${currentSet.id || sIdx}`}
            data-scroll-index={actualSetIdx}
            className="space-y-4 scroll-mt-24"
          >
            <TopicHeaderBanner
              topicName={topicName}
              setInfo={`Set ${actualSetIdx + 1} of ${sets.length}`}
              isDarkMode={isDarkMode}
            />
            <div
              className="p-6 sm:p-7 rounded-2xl border transition-all space-y-6 shadow-xs"
              style={{
                backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
                color: isDarkMode ? '#ffffff' : '#0f172a'
              }}
            >
              {/* Shared Audio Player for the set */}
              <div className="mb-6">
                <AudioPlayer
                  partNumber={2}
                  audioUrl={currentSet.audioUrl}
                  audioContent={currentSet.audioContent || currentSet.description}
                  requestedVoiceProfile={currentSet.requestedVoiceProfile || 'en-GB-female'}
                  transcript={currentSet.transcript}
                  isDarkMode={isDarkMode}
                  isSubmitted={submitted}
                />
              </div>

              {/* Matching Statements / Questions rows matching Reading Part 4-5 UI */}
              <div className="space-y-3 mb-6">
                {items.map((item, idx) => {
                  const itemKey = item.id;
                  const selectedValue = userAnswers[itemKey] || '';
                  const isItemFlagged = markedQuestions[itemKey];

                  const result = results?.[itemKey];

                  const hasValidServerResult =
                    result?.status === 'completed' &&
                    typeof result?.isCorrect === 'boolean' &&
                    result?.correctAnswer !== null &&
                    result?.correctAnswer !== undefined;

                  const isChecking = !!checkingQuestions?.[itemKey];
                  const checkError = checkErrors?.[itemKey];
                  const showResult = submitted || hasValidServerResult;
                  const isCorrect = hasValidServerResult ? result.isCorrect : null;

                  const rawCorrectAnswerKey = result?.correctAnswer || item.correctAnswer;
                  const correctOptObj = (hasValidServerResult || showResult) && rawCorrectAnswerKey
                    ? (currentSet.options || []).find(
                        (o) => String(o.key).toUpperCase() === String(rawCorrectAnswerKey).toUpperCase()
                      )
                    : null;
                  const correctLabel = correctOptObj
                    ? (correctOptObj.label || correctOptObj.text || '').replace(/^[A-Z]\.\s*/i, '').trim()
                    : rawCorrectAnswerKey;

                  let rowBg = isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc';
                  let rowBorder = isDarkMode ? '#334155' : '#e2e8f0';

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
                      key={itemKey || idx}
                      className="p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all scroll-mt-24 shadow-2xs"
                      style={{
                        backgroundColor: rowBg,
                        borderColor: rowBorder
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
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
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs sm:text-sm font-semibold leading-relaxed"
                            style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                          >
                            {/^What does Person/i.test(item.prompt) || !item.prompt ? `Person ${String.fromCharCode(65 + idx)}` : item.prompt}
                          </p>
                          {isChecking && (
                            <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> Checking...
                            </p>
                          )}
                          {checkError && (
                            <div className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                              <AlertCircle className="w-3 h-3" aria-hidden="true" />
                              <span>{checkError}</span>
                              <button
                                onClick={() => onCheckQuestion && selectedValue && onCheckQuestion(itemKey, selectedValue)}
                                className="ml-1 underline font-bold"
                              >
                                Retry check
                              </button>
                            </div>
                          )}
                          {hasValidServerResult && !isCorrect && correctLabel && (
                            <p className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 leading-snug">
                              ✓ Correct answer: {correctLabel}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end shrink-0">
                        {/* Option Dropdown matching Reading Part 4-5 */}
                        <select
                          disabled={showResult || isChecking}
                          value={selectedValue}
                          onChange={(e) => onSelectOption(itemKey, e.target.value)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-[380px] md:w-[420px] disabled:opacity-50"
                          style={{
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                            borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                            color: isDarkMode ? '#ffffff' : '#0f172a'
                          }}
                        >
                          <option value="" style={{ color: '#64748b' }}>Select answer</option>
                          {(currentSet.options || []).map((opt) => {
                            const cleanLabel = (opt.label || opt.text || '').replace(/^[A-Z]\.\s*/i, '').trim();
                            return (
                              <option
                                key={opt.key}
                                value={opt.key}
                                style={{
                                  backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                                  color: isDarkMode ? '#ffffff' : '#0f172a'
                                }}
                              >
                                {cleanLabel}
                              </option>
                            );
                          })}
                        </select>

                        {/* Mark item button */}
                        <button
                          onClick={() => onToggleMark(itemKey)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            isItemFlagged
                              ? 'bg-amber-500/10 border-amber-400 text-amber-500'
                              : isDarkMode
                                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isItemFlagged ? 'fill-amber-400 text-amber-500' : ''}`} />
                          <span>Mark</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Set Action buttons matching Reading Part 4-5 */}
              <div className="pt-5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleMark(currentSet.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      isSetFlagged
                        ? 'bg-amber-500/10 border-amber-400 text-amber-600 dark:text-amber-400'
                        : 'bg-white border-[#2563eb] text-[#2563eb] hover:bg-blue-50/50'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSetFlagged ? 'fill-amber-400 text-amber-500' : ''}`} />
                    <span>{isSetFlagged ? 'Marked this set' : 'Mark this set'}</span>
                  </button>

                  <button
                    onClick={handleCheckSet}
                    disabled={isSetChecking}
                    aria-live="polite"
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all border border-blue-500 text-[#2563eb] hover:bg-blue-50 disabled:opacity-50"
                  >
                    {isSetChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>{submitted ? 'Set Checked' : 'Check this set'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })}

      {/* Topic Navigation Bar (< and >) in whitespace below question container ONLY when in topic mode */}
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
};

