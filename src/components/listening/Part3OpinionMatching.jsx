import React, { useMemo, useEffect, useRef } from 'react';
import { Bookmark, Check, User, Users, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
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

export const Part3OpinionMatching = ({
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
        const statements = currentSet.statements || [];
        const isSetChecking = statements.some((st) => checkingQuestions?.[st.id]);
        const isSetFlagged = markedQuestions[currentSet.id];

        const displayOptions = currentSet.options || [
          { key: 'man', label: 'Man' },
          { key: 'woman', label: 'Woman' },
          { key: 'both', label: 'Both' }
        ];

        const rawTopicName = currentSet.topic || currentSet.topicName || currentSet.title || 'OPINION MATCHING';
        const topicName = cleanTopicTitle(rawTopicName) || 'OPINION MATCHING';

        // Set-level confetti check
        useEffect(() => {
          if (!results || statements.length === 0) return;
          const answeredStatements = statements.filter((st) => userAnswers[st.id]);
          if (answeredStatements.length === 0) return;

          const allAnsweredValid = answeredStatements.every((st) => {
            const res = results[st.id];
            return res?.status === 'completed' && typeof res?.isCorrect === 'boolean';
          });

          const allAnsweredCorrect = answeredStatements.every((st) => results[st.id]?.isCorrect === true);

          if (allAnsweredValid && allAnsweredCorrect) {
            const setEvalHash = answeredStatements.map((st) => `${st.id}:${results[st.id]?.evaluationId}`).join('|');
            if (!firedConfettiRef.current.has(setEvalHash)) {
              firedConfettiRef.current.add(setEvalHash);
              confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
            }
          }
        }, [results, statements, userAnswers]);

        const handleCheckSet = () => {
          if (!onCheckQuestion) return;
          statements.forEach((st) => {
            const val = userAnswers[st.id];
            if (val && st.id) {
              onCheckQuestion(st.id, val);
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
              {/* Audio Player */}
              <div className="mb-6">
                <AudioPlayer
                  partNumber={3}
                  audioUrl={currentSet.audioUrl}
                  audioContent={currentSet.audioContent || currentSet.description}
                  requestedVoiceProfile={currentSet.requestedVoiceProfile || 'en-GB-female'}
                  transcript={currentSet.transcript}
                  isDarkMode={isDarkMode}
                  isSubmitted={submitted}
                />
              </div>

              {/* Statements List matching Reading Part 4-5 */}
              <div className="space-y-3 mb-6">
                {statements.map((st, idx) => {
                  const stKey = st.id;
                  const selectedVal = userAnswers[stKey] || '';
                  const selectedValNorm = String(selectedVal).toLowerCase();

                  const result = results?.[stKey];

                  const hasValidServerResult =
                    result?.status === 'completed' &&
                    typeof result?.isCorrect === 'boolean' &&
                    result?.correctAnswer !== null &&
                    result?.correctAnswer !== undefined;

                  const isChecking = !!checkingQuestions?.[stKey];
                  const checkError = checkErrors?.[stKey];
                  const showResult = submitted || hasValidServerResult;
                  const isCorrect = hasValidServerResult ? result.isCorrect : null;

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

                  let dropdownStyle = isDarkMode
                    ? 'bg-[#1e293b] border-[#334155] text-white'
                    : 'bg-white border-[#cbd5e1] text-[#0f172a]';

                  if (selectedValNorm === 'man') {
                    dropdownStyle = isDarkMode 
                      ? 'bg-[#1e293b] border-blue-500 text-blue-400 font-extrabold' 
                      : 'bg-white border-blue-400 text-blue-600 font-extrabold';
                  } else if (selectedValNorm === 'woman') {
                    dropdownStyle = isDarkMode 
                      ? 'bg-[#1e293b] border-purple-500 text-purple-400 font-extrabold' 
                      : 'bg-white border-purple-400 text-purple-600 font-extrabold';
                  } else if (selectedValNorm === 'both') {
                    dropdownStyle = isDarkMode 
                      ? 'bg-[#1e293b] border-emerald-500 text-emerald-400 font-extrabold' 
                      : 'bg-white border-emerald-400 text-emerald-600 font-extrabold';
                  }

                  return (
                    <div
                      key={stKey || idx}
                      className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all scroll-mt-24 shadow-2xs"
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
                            {st.text}
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
                                onClick={() => onCheckQuestion && selectedVal && onCheckQuestion(stKey, selectedVal)}
                                className="ml-1 underline font-bold"
                              >
                                Retry check
                              </button>
                            </div>
                          )}
                          {hasValidServerResult && !isCorrect && (result?.correctAnswer || st.correctAnswer) && (
                            <p className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 leading-snug">
                              ✓ Correct answer: {result?.correctAnswer || st.correctAnswer}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        <div className="relative w-full sm:w-52">
                          {selectedValNorm === 'man' && (
                            <User className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                          {selectedValNorm === 'woman' && (
                            <User className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                          {selectedValNorm === 'both' && (
                            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}

                          <select
                            disabled={showResult || isChecking}
                            value={selectedVal}
                            onChange={(e) => onSelectOption(stKey, e.target.value)}
                            className={`w-full py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                              selectedValNorm ? 'pl-9 pr-8' : 'px-3.5'
                            } ${dropdownStyle}`}
                          >
                            <option value="" style={{ color: '#64748b' }}>Select option</option>
                            {displayOptions.map((opt) => (
                              <option
                                key={opt.key}
                                value={opt.key}
                                style={{
                                  backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                                  color: isDarkMode ? '#ffffff' : '#0f172a'
                                }}
                              >
                                {opt.label || opt.key}
                              </option>
                            ))}
                          </select>
                        </div>
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

