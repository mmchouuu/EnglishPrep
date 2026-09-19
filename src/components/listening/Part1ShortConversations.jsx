import React, { useMemo } from 'react';
import { 
  Check, 
  CircleCheck, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import BookmarkButton from '../reading/BookmarkButton';
import TopicHeaderBanner from '../reading/TopicHeaderBanner';

export const Part1ShortConversations = ({
  questions = [],
  currentIndex = 0,
  onSelectIndex,
  userAnswers = {},
  onSelectOption,
  markedQuestions = {},
  onToggleMark,
  submittedQuestions = {},
  onSubmitSingle,
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

  const displayGroupName = activeGroup?.name || activeGroup?.group_key || 'Short Conversations';

  // Questions to render: filter by current topic group when mode is topic
  const questionsToRender = useMemo(() => {
    if (mode === 'topic') {
      if (activeGroup && activeGroup.group_key) {
        const groupKey = activeGroup.group_key;
        const filtered = questions.filter(q => 
          q.groupKey === groupKey || 
          (q.sourceKey && q.sourceKey.toLowerCase().includes(groupKey.toLowerCase())) ||
          (q.topic && activeGroup.name && q.topic.toLowerCase().includes(activeGroup.name.toLowerCase()))
        );
        if (filtered.length > 0) return filtered;
      }
      const numGroups = groups.length || 1;
      const chunkSize = Math.max(1, Math.ceil(questions.length / numGroups));
      const start = currentGroupIdx * chunkSize;
      return questions.slice(start, start + chunkSize);
    }
    return questions;
  }, [mode, questions, activeGroup, currentGroupIdx, groups.length]);

  return (
    <div className="space-y-6">
      {/* Show TopicHeaderBanner when filtering by group/topic */}
      {mode === 'topic' && (
        <TopicHeaderBanner
          topicName={displayGroupName}
          setInfo={`${questionsToRender.length} question(s)`}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Empty State if group has no questions */}
      {questionsToRender.length === 0 && (
        <div className={`p-8 text-center rounded-2xl border ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
        }`}>
          No questions available in this topic group.
        </div>
      )}

      {questionsToRender.map((currentQ, renderIdx) => {
        const actualIdx = renderIdx;
        const qId = currentQ.id || renderIdx;
        const ansKey = currentQ.id || `${currentQ.sourceKey}_p1`;
        const selectedOpt = userAnswers[ansKey];
        const isSub = submittedQuestions[currentQ.id];
        const isFlagged = markedQuestions[currentQ.id];

        return (
          <div
            key={qId}
            id={`question-${qId}`}
            data-scroll-index={actualIdx}
            className="rounded-2xl p-5 sm:p-6 border transition-all space-y-5 scroll-mt-24"
            style={{
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
              borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
            }}
          >
            {/* Top row: Number circle badge, Prompt/Topic title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 flex-1">
                <span
                  className="w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#eff6ff',
                    borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe',
                    color: '#2563eb'
                  }}
                >
                  {actualIdx + 1}
                </span>
                <div className="text-sm font-extrabold tracking-tight" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {currentQ.question || currentQ.topic || 'Sentence Comprehension'}
                </div>
              </div>
            </div>

            {/* Audio Player component */}
            <AudioPlayer
              partNumber={1}
              audioUrl={currentQ.audioUrl}
              audioContent={currentQ.audioContent || currentQ.question}
              requestedVoiceProfile={currentQ.requestedVoiceProfile || 'en-GB-female'}
              transcript={currentQ.transcript}
              explanation={currentQ.explanation}
              translation={currentQ.translation}
              isDarkMode={isDarkMode}
              isSubmitted={isSub}
            />

            {/* Options List matching Reading Part 1 radio card layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
              {(currentQ.options || []).map((opt, idx) => {
                const optText = typeof opt === 'string' ? opt : (opt.text || opt.content || '');
                const optKey = typeof opt === 'string' ? String.fromCharCode(65 + idx) : (opt.key || String.fromCharCode(65 + idx));
                const isSelected = selectedOpt === optKey || selectedOpt === idx;

                let cardBg = isDarkMode ? '#1e293b' : '#ffffff';
                let cardBorder = isDarkMode ? '#334155' : '#d8e2ef';
                let cardTextColor = isDarkMode ? '#e2e8f0' : '#172033';

                if (isSelected) {
                  cardBg = isDarkMode ? 'rgba(30, 58, 138, 0.6)' : '#eff6ff';
                  cardBorder = '#2563eb';
                  cardTextColor = isDarkMode ? '#ffffff' : '#0f172a';
                }

                if (isSub && currentQ.correctAnswer !== undefined && currentQ.correctAnswer !== null) {
                  const correctKey = typeof currentQ.correctAnswer === 'number'
                    ? String.fromCharCode(65 + currentQ.correctAnswer)
                    : String(currentQ.correctAnswer).toUpperCase();

                  if (optKey.toUpperCase() === correctKey) {
                    cardBg = 'rgba(16, 185, 129, 0.15)';
                    cardBorder = '#10b981';
                    cardTextColor = isDarkMode ? '#6ee7b7' : '#047857';
                  } else if (isSelected && optKey.toUpperCase() !== correctKey) {
                    cardBg = 'rgba(239, 68, 68, 0.15)';
                    cardBorder = '#ef4444';
                    cardTextColor = isDarkMode ? '#fca5a5' : '#b91c1c';
                  }
                }

                return (
                  <button
                    key={optKey || idx}
                    disabled={isSub}
                    onClick={() => onSelectOption(ansKey, optKey)}
                    className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: cardBg,
                      borderColor: cardBorder,
                      color: cardTextColor,
                      fontWeight: isSelected ? 700 : 600
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isSelected
                        ? 'border-blue-500 bg-[#2563eb] text-white'
                        : isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-400' : 'border-slate-400 bg-white text-slate-600'
                    }`}>
                      {isSelected ? <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" /> : optKey}
                    </div>
                    <span className="flex-1 font-semibold">{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Post-submit explanation */}
            {isSub && (
              (() => {
                const correctKey = currentQ.correctAnswer !== undefined && currentQ.correctAnswer !== null
                  ? (typeof currentQ.correctAnswer === 'number'
                      ? String.fromCharCode(65 + currentQ.correctAnswer)
                      : String(currentQ.correctAnswer).toUpperCase())
                  : null;
                const isCorrectChoice = selectedOpt !== undefined && String(selectedOpt).toUpperCase() === correctKey;

                return (
                  <div className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                    isCorrectChoice
                      ? isDarkMode ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : isDarkMode ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {isCorrectChoice ? (
                      <CircleCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <CircleCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div>
                      <span className="font-bold mr-1.5">{isCorrectChoice ? 'Correct!' : 'Incorrect.'}</span>
                      {currentQ.explanation || (correctKey ? `Correct answer is Option ${correctKey}.` : 'Answer checked.')}
                    </div>
                  </div>
                );
              })()
            )}

            {/* Footer Action Bar: Mark & Check on the Right */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-200/80 dark:border-slate-800 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <BookmarkButton
                  isBookmarked={isFlagged}
                  onToggle={() => onToggleMark(currentQ.id)}
                  isDarkMode={isDarkMode}
                />
                
                <button
                  disabled={selectedOpt === undefined || isSub}
                  onClick={() => onSubmitSingle(currentQ.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
                    isSub
                      ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                      : selectedOpt !== undefined
                        ? 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-blue-500/20'
                        : 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isSub ? 'Checked' : 'Check answer'}</span>
                </button>
              </div>
            </div>

          </div>
        );
      })}

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
};
