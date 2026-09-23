import React, { useMemo, useRef, useEffect } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, CircleCheck, X } from 'lucide-react';
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

const MonologueSetCard = ({
  currentSet,
  sIdx,
  actualSetIdx,
  allSetsCount,
  userAnswers,
  results,
  checkingQuestions,
  checkErrors,
  markedQuestions,
  onSelectOption,
  onToggleMark,
  onCheckQuestion,
  submitted,
  isDarkMode
}) => {
  const firedConfettiRef = useRef(new Set());
  const questions = currentSet.questions || [];
  const isSetChecking = questions.some((q) => checkingQuestions?.[q.id]);
  const isSetFlagged = markedQuestions[currentSet.id];
  const rawTopicName = currentSet.topicName || currentSet.topic || currentSet.title || 'LONGER MONOLOGUES';
  const topicName = cleanTopicTitle(rawTopicName) || 'LONGER MONOLOGUES';

  const answeredQuestions = useMemo(() => {
    return questions.filter(q => userAnswers[q.id]);
  }, [questions, userAnswers]);

  useEffect(() => {
    if (!answeredQuestions.length) return;

    const resultsArray = answeredQuestions.map(q => results?.[q.id]);

    const allCompleted = resultsArray.every(res =>
      res?.status === 'completed' &&
      typeof res?.isCorrect === 'boolean' &&
      res?.correctAnswer !== null &&
      res?.correctAnswer !== undefined
    );

    if (allCompleted) {
      const allCorrect = resultsArray.every(res => res.isCorrect === true);
      if (allCorrect) {
        const key = `set:${currentSet.id}:${resultsArray.map(r => r.evaluationId || r.responseId || '').join('-')}`;
        if (!firedConfettiRef.current.has(key)) {
          firedConfettiRef.current.add(key);
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {
            console.error('Confetti trigger failed:', e);
          }
        }
      }
    }
  }, [answeredQuestions, results, currentSet.id]);

  const handleCheckSet = () => {
    if (!onCheckQuestion) return;
    questions.forEach((q) => {
      const val = userAnswers[q.id];
      if (val && q.id) {
        onCheckQuestion(q.id, val);
      }
    });
  };

  return (
    <div
      id={`set-${currentSet.id || sIdx}`}
      data-scroll-index={actualSetIdx}
      className="space-y-4 scroll-mt-24"
    >
      <TopicHeaderBanner
        topicName={topicName}
        setInfo={`Set ${actualSetIdx + 1} of ${allSetsCount}`}
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
        {/* Audio Player for the monologue */}
        <div>
          <AudioPlayer
            partNumber={4}
            audioUrl={currentSet.audioUrl}
            audioContent={currentSet.audioContent || currentSet.title}
            requestedVoiceProfile={currentSet.requestedVoiceProfile || 'en-GB-female'}
            transcript={currentSet.transcript}
            isDarkMode={isDarkMode}
            isSubmitted={submitted}
          />
        </div>

        {/* Multiple Choice Questions Stacked Vertically */}
        <div className="space-y-6 pt-2">
          {questions.map((q, qIdx) => {
            const qKey = q.id;
            const selectedOpt = userAnswers[qKey];
            const result = results?.[qKey];

            const hasValidServerResult =
              result?.status === 'completed' &&
              typeof result?.isCorrect === 'boolean' &&
              result?.correctAnswer !== null &&
              result?.correctAnswer !== undefined;

            const isChecking = !!checkingQuestions?.[qKey];
            const checkError = checkErrors?.[qKey];
            const isFlagged = markedQuestions[qKey];

            return (
              <div
                key={qKey || qIdx}
                id={`question-${qKey}`}
                className="p-4 rounded-xl border space-y-4 scroll-mt-24 shadow-2xs"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0'
                }}
              >
                {/* Question Top Header with Prompt & Buttons */}
                <div className="flex items-start justify-between gap-4 flex-wrap pb-1">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff',
                        borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe',
                        color: '#2563eb'
                      }}
                    >
                      {qIdx + 1}
                    </span>
                    <p
                      className="text-xs sm:text-sm font-semibold leading-relaxed"
                      style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                    >
                      {q.question}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onToggleMark(qKey)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isFlagged
                          ? 'bg-amber-500/10 border-amber-400 text-amber-500'
                          : isDarkMode
                            ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-400 text-amber-500' : ''}`} />
                      <span>Mark</span>
                    </button>
                  </div>
                </div>

                {/* Options List A-D */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {(q.options || []).map((opt, idx) => {
                    const optText = typeof opt === 'string' ? opt : (opt.text || opt.content || opt.label || '');
                    const optKey = typeof opt === 'string'
                      ? String.fromCharCode(65 + idx)
                      : (opt.key || opt.option_key || opt.value || opt.id || String.fromCharCode(65 + idx));
                    const isSelected = selectedOpt === optKey || selectedOpt === idx;

                    let cardBg = isDarkMode ? '#1e293b' : '#ffffff';
                    let cardBorder = isDarkMode ? '#334155' : '#d8e2ef';
                    let cardTextColor = isDarkMode ? '#e2e8f0' : '#172033';

                    if (isSelected) {
                      cardBg = isDarkMode ? 'rgba(30, 58, 138, 0.6)' : '#eff6ff';
                      cardBorder = '#2563eb';
                      cardTextColor = isDarkMode ? '#ffffff' : '#0f172a';
                    }

                    if (hasValidServerResult) {
                      const correctKey = String(result.correctAnswer).toUpperCase();

                      if (String(optKey).toUpperCase() === correctKey) {
                        cardBg = 'rgba(16, 185, 129, 0.15)';
                        cardBorder = '#10b981';
                        cardTextColor = isDarkMode ? '#6ee7b7' : '#047857';
                      } else if (isSelected && String(optKey).toUpperCase() !== correctKey) {
                        cardBg = 'rgba(239, 68, 68, 0.15)';
                        cardBorder = '#ef4444';
                        cardTextColor = isDarkMode ? '#fca5a5' : '#b91c1c';
                      }
                    }

                    return (
                      <button
                        key={optKey || idx}
                        disabled={hasValidServerResult || isChecking}
                        onClick={() => onSelectOption(qKey, optKey)}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        style={{
                          backgroundColor: cardBg,
                          borderColor: cardBorder,
                          color: cardTextColor,
                          fontWeight: isSelected ? 700 : 600
                        }}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isSelected
                            ? (hasValidServerResult && !result?.isCorrect ? 'border-rose-500 bg-rose-600 text-white' : 'border-blue-500 bg-[#2563eb] text-white')
                            : isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-400' : 'border-slate-400 bg-white text-slate-600'
                        }`}>
                          {isSelected ? (hasValidServerResult && !result?.isCorrect ? <X className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" /> : <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />) : optKey}
                        </div>
                        <span className="flex-1 font-semibold">{optText}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Checking spinner & error banner */}
                {isChecking && (
                  <div className="text-xs text-blue-500 flex items-center gap-1" aria-live="polite">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </div>
                )}

                {checkError && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium" aria-live="assertive">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkError}</span>
                    </div>
                    <button
                      onClick={() => onCheckQuestion && selectedOpt && onCheckQuestion(qKey, selectedOpt)}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shrink-0"
                    >
                      Retry check
                    </button>
                  </div>
                )}

                {/* Explanation box when checked */}
                {hasValidServerResult && (
                  <div
                    aria-live="polite"
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      result.isCorrect
                        ? isDarkMode ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : isDarkMode ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <CircleCheck className={`w-4 h-4 shrink-0 mt-0.5 ${result.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`} />
                    <div>
                      <span className="font-bold mr-1.5">{result.isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                      {result.explanation || (result.correctAnswer ? `Correct answer is Option ${result.correctAnswer}.` : 'Answer checked.')}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* Set Action buttons matching Part 2 & Part 3 */}
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
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all border border-blue-500 text-[#2563eb] hover:bg-blue-50 disabled:opacity-50"
            >
              {isSetChecking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Check this set</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const Part4Monologues = ({
  topicGroups = [],
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
  const currentGroupIdx = useMemo(() => {
    if (!groups || groups.length === 0) return 0;
    const activeKey = activeGroup?.group_key || activeGroup?.key;
    const idx = groups.findIndex((g) => g.group_key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [groups, activeGroup]);

  const displayGroupName = cleanTopicTitle(activeGroup?.name || activeGroup?.group_key || topicGroups[0]?.topicName || 'Topic');

  // Flatten all sets from topic groups
  const allSets = topicGroups.flatMap(g => g.sets || []);
  if (allSets.length === 0) return null;

  const setsToRender = mode === 'full'
    ? allSets
    : [allSets[currentSetIndex] || allSets[0]];

  return (
    <div className="space-y-8">
      {setsToRender.map((currentSet, sIdx) => {
        const actualSetIdx = mode === 'full' ? sIdx : currentSetIndex;
        return (
          <MonologueSetCard
            key={currentSet.id || sIdx}
            currentSet={currentSet}
            sIdx={sIdx}
            actualSetIdx={actualSetIdx}
            allSetsCount={allSets.length}
            userAnswers={userAnswers}
            results={results}
            checkingQuestions={checkingQuestions}
            checkErrors={checkErrors}
            markedQuestions={markedQuestions}
            onSelectOption={onSelectOption}
            onToggleMark={onToggleMark}
            onCheckQuestion={onCheckQuestion}
            submitted={submitted}
            isDarkMode={isDarkMode}
          />
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


