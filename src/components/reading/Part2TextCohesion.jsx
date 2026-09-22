import React, { useState, useEffect, useMemo } from 'react';
import BookmarkButton from './BookmarkButton';
import TopicHeaderBanner from './TopicHeaderBanner';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

/**
 * Single Sentence Ordering Exercise Set Item
 */
function OrderingSetCard({
  setObj = {},
  setIndex = 0,
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  onUpdateOrdering,
  onToggleBookmark,
  isDarkMode = false
}) {
  const setId = setObj.id || `p2-set-${setIndex + 1}`;
  const initialSentences = setObj.sentences || [];

  const [orderedSentences, setOrderedSentences] = useState([]);
  const [checkedSet, setCheckedSet] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    if (userAnswers[setId]) {
      const sentenceMap = new Map(initialSentences.map((s) => [s.id, s]));
      const restored = userAnswers[setId]
        .map((sId) => sentenceMap.get(sId))
        .filter(Boolean);
      setOrderedSentences(restored.length ? restored : initialSentences);
    } else {
      setOrderedSentences(initialSentences);
    }
  }, [setObj, userAnswers, setId]);

  const handleMove = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= orderedSentences.length) return;
    const updated = [...orderedSentences];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIdx, 0, moved);
    setOrderedSentences(updated);
    onUpdateOrdering(setId, updated.map((s) => s.id));
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const updated = [...orderedSentences];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    setOrderedSentences(updated);
    setDraggedIndex(targetIndex);
    onUpdateOrdering(setId, updated.map((s) => s.id));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleResetOrder = () => {
    setOrderedSentences(initialSentences);
    onUpdateOrdering(setId, initialSentences.map((s) => s.id));
    setCheckedSet(false);
  };

  const isBookmarked = !!bookmarks[setId];
  const showResult = submitted || checkedSet;

  return (
    <div
      className="p-6 rounded-2xl border transition-all shadow-xs space-y-4"
      style={{
        backgroundColor: isDarkMode ? '#111827' : '#ffffff',
        borderColor: isDarkMode ? '#29364a' : '#d8e2ef'
      }}
    >
      {/* Sentence Items List */}
      <div className="space-y-3 mb-6">
        {orderedSentences.map((s, idx) => {
          const isCorrectPos = showResult && setObj.correctOrder && setObj.correctOrder[idx] === s.id;
          const targetPosIndex = setObj.correctOrder ? setObj.correctOrder.indexOf(s.id) : -1;
          const targetPosNumber = targetPosIndex >= 0 ? targetPosIndex + 1 : null;
          const isBeingDragged = draggedIndex === idx;

          let itemBg = isDarkMode ? '#1e293b' : '#ffffff';
          let itemBorder = isDarkMode ? '#334155' : '#d8e2ef';
          let itemTextColor = isDarkMode ? '#f8fafc' : '#172033';

          if (showResult) {
            if (isCorrectPos) {
              itemBg = isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5';
              itemBorder = '#10b981';
              itemTextColor = isDarkMode ? '#6ee7b7' : '#047857';
            } else {
              itemBg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2';
              itemBorder = '#ef4444';
              itemTextColor = isDarkMode ? '#fca5a5' : '#b91c1c';
            }
          }

          return (
            <div
              key={s.id || idx}
              draggable={!showResult}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all shadow-xs cursor-grab active:cursor-grabbing ${isBeingDragged ? 'opacity-40 scale-[0.99] border-dashed border-blue-500 bg-blue-50/20' : ''
                }`}
              style={{
                backgroundColor: itemBg,
                borderColor: itemBorder
              }}
            >
              <GripVertical className="w-4 h-4 text-slate-400 hover:text-[#2563eb] shrink-0" aria-hidden="true" />

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
                className="flex-1 text-sm font-semibold leading-relaxed"
                style={{ color: itemTextColor }}
              >
                {s.text}
              </span>

              {showResult && !isCorrectPos && targetPosNumber && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
                  Correct position: #{targetPosNumber}
                </span>
              )}

              <div className="flex items-center gap-1 shrink-0">
                <button
                  disabled={idx === 0 || showResult}
                  onClick={() => handleMove(idx, -1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
                  title="Move Up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  disabled={idx === orderedSentences.length - 1 || showResult}
                  onClick={() => handleMove(idx, 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
                  title="Move Down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleResetOrder}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${isDarkMode
            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs'
            }`}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset order</span>
        </button>

        <div className="flex items-center gap-3">
          <BookmarkButton
            isBookmarked={isBookmarked}
            onToggle={() => onToggleBookmark(setId)}
            isDarkMode={isDarkMode}
          />
          <button
            onClick={() => setCheckedSet(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold border border-blue-500 text-[#2563eb] hover:bg-blue-50 transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Check this set</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Part 2–3: Text Cohesion (Sentence Ordering)
 * Renders exercise sets grouped under their respective topics.
 */
export default function Part2TextCohesion({
  set = {},
  sets = [],
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  results = null,
  onUpdateOrdering,
  onToggleBookmark,
  isDarkMode = false,
  mode = 'full',
  groups = [],
  activeGroup = null,
  onSelectGroup
}) {
  const displaySets = useMemo(() => {
    if (sets && sets.length > 0) return sets;
    return set && set.id ? [set] : [];
  }, [sets, set]);

  const topicGroups = useMemo(() => {
    const map = new Map();
    displaySets.forEach((s) => {
      const topic = s.topicName || activeGroup?.name || 'TEXT COHESION';
      if (!map.has(topic)) map.set(topic, []);
      map.get(topic).push(s);
    });
    return Array.from(map.entries()).map(([topicName, items]) => ({ topicName, items }));
  }, [displaySets, activeGroup]);

  const currentGroupIdx = useMemo(() => {
    if (!groups || groups.length === 0) return 0;
    const activeKey = activeGroup?.group_key || activeGroup?.key;
    const idx = groups.findIndex((g) => g.group_key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [groups, activeGroup]);

  const displayTopicGroups = useMemo(() => {
    if (mode === 'topic') {
      const idx = currentGroupIdx >= 0 && currentGroupIdx < topicGroups.length ? currentGroupIdx : 0;
      return topicGroups[idx] ? [topicGroups[idx]] : (topicGroups[0] ? [topicGroups[0]] : []);
    }
    return topicGroups;
  }, [mode, topicGroups, currentGroupIdx]);

  const displayGroupName = activeGroup?.name || activeGroup?.group_key || 'Text Cohesion';

  if (displaySets.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
        }`}>
        No exercise sets available for Part 2-3.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {displayTopicGroups.map((group, gIdx) => (
        <div key={group.topicName || gIdx} id={`part2-topic-${gIdx}`} className="space-y-6 scroll-mt-24">
          {/* Topic Card Banner */}
          <TopicHeaderBanner
            topicName={group.topicName}
            setInfo={`${group.items.length} exercise set(s)`}
            isDarkMode={isDarkMode}
          />

          {/* Exercise Sets under Topic */}
          <div className="space-y-6">
            {group.items.map((setObj, sIdx) => (
              <div key={setObj.id || sIdx} id={`part2-set-${setObj.id}`} data-scroll-index={sIdx} className="scroll-mt-24">
                <OrderingSetCard
                  setObj={setObj}
                  setIndex={sIdx}
                  userAnswers={userAnswers}
                  bookmarks={bookmarks}
                  submitted={submitted}
                  results={results}
                  onUpdateOrdering={onUpdateOrdering}
                  onToggleBookmark={onToggleBookmark}
                  isDarkMode={isDarkMode}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

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
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${currentGroupIdx > 0
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
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${currentGroupIdx < groups.length - 1
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
