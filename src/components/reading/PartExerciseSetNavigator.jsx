import React, { useState, useMemo } from 'react';
import { Flag, ChevronDown } from 'lucide-react';
import ReadingTimerProgressWidget from './ReadingTimerProgressWidget';
import NavigatorActionButtons from '../common/NavigatorActionButtons';

/**
 * Dynamic Topic & Question Navigator Component for Aptis Reading
 * Supports Part 2-3, Part 4, and Part 5.
 * Features:
 * - Dynamic topic names fetched directly from DB
 * - Part 2-3 lists titled exercise sets directly without extra category header
 * - Uses shared NavigatorActionButtons component
 */
export default function PartExerciseSetNavigator({
  selectedPart = '2-3',
  adaptedData = null,
  rawQuestions = [],
  userAnswers = {},
  bookmarks = {},
  submitted = false,
  onSubmitAll,
  onSelectSet,
  currentSetId = '',
  isDarkMode = false
}) {
  const titleMap = {
    '2-3': 'Questions 6 – 15',
    '4': 'Questions 16 – 22',
    '5': 'Questions 23 – 29'
  };
  const sectionTitle = titleMap[selectedPart] || 'Questions';

  // Build dynamic topics structure from adaptedData
  const topicsList = useMemo(() => {
    if (selectedPart === '2-3') {
      const displaySets = adaptedData?.sets || [];
      if (displaySets.length > 0) {
        const groupsMap = new Map();
        displaySets.forEach((s, idx) => {
          const topicName = s.topicName || 'TEXT COHESION';
          if (!groupsMap.has(topicName)) {
            groupsMap.set(topicName, []);
          }
          groupsMap.get(topicName).push({ ...s, globalSetNum: idx + 1 });
        });

        return Array.from(groupsMap.entries()).map(([name, setItems], gIdx) => ({
          key: `p2-group-${gIdx}`,
          gIdx,
          name,
          items: setItems.map((s) => ({
            id: s.id,
            label: String(s.globalSetNum),
            title: s.title || `Exercise Set ${s.globalSetNum}`,
            rawItem: s
          }))
        }));
      }
    } else if (selectedPart === '4' || selectedPart === '5') {
      const topicSets = adaptedData?.topicSets || [];
      if (topicSets.length > 0) {
        return topicSets.map((ts, tIdx) => {
          const itemsList = selectedPart === '4'
            ? (ts.questions || []).map((q, qIdx) => ({
              id: q.id,
              label: String(q.num || qIdx + 1),
              rawItem: q
            }))
            : (ts.sections || []).map((sec, sIdx) => ({
              id: sec.id,
              label: String(sIdx + 1),
              rawItem: sec
            }));

          return {
            key: ts.id || `topic-set-${tIdx}`,
            tIdx,
            id: ts.id,
            name: ts.topicName || `TOPIC ${tIdx + 1}`,
            items: itemsList
          };
        });
      }
    }

    // Fallback if adaptedData is loading or empty
    return [
      {
        key: 'fallback-1',
        gIdx: 0,
        tIdx: 0,
        name: selectedPart === '4' ? 'HEALTHY LIFESTYLES' : (selectedPart === '5' ? 'SCIENCE & TECHNOLOGY' : 'WORK & STUDY'),
        items: Array.from({ length: selectedPart === '2-3' ? 3 : 7 }, (_, i) => ({
          id: `fallback-${i + 1}`,
          label: String(i + 1),
          title: `Exercise Set ${i + 1}`
        }))
      }
    ];
  }, [selectedPart, adaptedData]);

  // Expanded state per topic key (default expanded)
  const [expandedTopics, setExpandedTopics] = useState({});
  const [filterBookmarked, setFilterBookmarked] = useState(false);

  const toggleTopic = (key) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  // Smooth scroll helper to target element ID
  const handleTopicClick = (topic) => {
    let elementId = '';
    if (selectedPart === '2-3') {
      elementId = `part2-topic-${topic.gIdx}`;
    } else if (selectedPart === '4') {
      elementId = `part4-topic-${topic.tIdx}`;
    } else if (selectedPart === '5') {
      elementId = `part5-topic-${topic.tIdx}`;
    }
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleItemClick = (topic, item) => {
    let elementId = '';
    if (selectedPart === '2-3') {
      elementId = `part2-set-${item.id}`;
    } else if (selectedPart === '4') {
      elementId = `part4-q-${item.id}`;
    } else if (selectedPart === '5') {
      elementId = `part5-q-${item.id}`;
    }

    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      handleTopicClick(topic);
    }
  };

  // Calculate statistics
  let totalItemsCount = 0;
  let answeredCount = 0;

  topicsList.forEach((topic) => {
    topic.items.forEach((item) => {
      totalItemsCount++;
      const ans = userAnswers[item.id];
      if (ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0)) {
        answeredCount++;
      }
    });
  });

  const flaggedCount = useMemo(() => {
    let count = 0;
    topicsList.forEach((topic) => {
      const isTopicBookmarked =
        !!bookmarks[`part4-${topic.id}`] ||
        !!bookmarks[`part5-${topic.id}`] ||
        !!bookmarks[topic.id];

      topic.items.forEach((item) => {
        const isItemFlagged = isTopicBookmarked || !!bookmarks[item.id];
        if (isItemFlagged) count++;
      });
    });
    return count;
  }, [topicsList, bookmarks]);

  // Build flattened list of items for Prev/Next navigation
  const allFlatItems = useMemo(() => {
    const flat = [];
    topicsList.forEach((topic) => {
      topic.items.forEach((item) => {
        flat.push({ topic, item });
      });
    });
    return flat;
  }, [topicsList]);

  const activeFlatIdx = useMemo(() => {
    if (!currentSetId) return 0;
    const idx = allFlatItems.findIndex(fi => fi.item.id === currentSetId);
    return idx >= 0 ? idx : 0;
  }, [allFlatItems, currentSetId]);

  const hasPrev = activeFlatIdx > 0;
  const hasNext = activeFlatIdx < allFlatItems.length - 1;

  const handlePrev = () => {
    if (hasPrev && allFlatItems[activeFlatIdx - 1]) {
      const prev = allFlatItems[activeFlatIdx - 1];
      if (onSelectSet) onSelectSet(prev.item.id);
      handleItemClick(prev.topic, prev.item);
    }
  };

  const handleNext = () => {
    if (hasNext && allFlatItems[activeFlatIdx + 1]) {
      const next = allFlatItems[activeFlatIdx + 1];
      if (onSelectSet) onSelectSet(next.item.id);
      handleItemClick(next.topic, next.item);
    }
  };

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-3 lg:sticky lg:top-20">
      {/* Top Timer & Progress Widget */}
      <ReadingTimerProgressWidget
        timeStr="00:00:00"
        answeredCount={answeredCount}
        totalCount={totalItemsCount}
        isDarkMode={isDarkMode}
      />

      {/* Main Sidebar Card with Flex Column Layout */}
      <div
        className="p-4 sm:p-5 rounded-2xl border transition-all flex flex-col max-h-[calc(100vh-10rem)] shadow-xs space-y-3 overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
          color: isDarkMode ? '#ffffff' : '#0f172a'
        }}
      >
        {/* Header (Shrink-0) */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h3
            className="text-sm sm:text-base font-extrabold tracking-tight"
            style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}
          >
            {sectionTitle}
          </h3>
        </div>

        {/* Legend Row (Shrink-0) */}
        <div
          className="flex items-center justify-between text-[11px] font-semibold pb-2 border-b shrink-0"
          style={{
            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
            color: isDarkMode ? '#cbd5e1' : '#334155'
          }}
        >
          <div className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded border"
              style={{
                borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                backgroundColor: isDarkMode ? '#0f172a' : '#ffffff'
              }}
            />
            <span>Not attempted</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#2563eb]" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-1">
            <Flag className="w-3 h-3 text-rose-500 fill-rose-500" aria-hidden="true" />
            <span>Flagged</span>
          </div>
        </div>

        {/* Topic Accordions or Direct List */}
        <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-[140px] max-h-[320px]">
          {topicsList.map((topic) => {
            const isExpanded = expandedTopics[topic.key] !== false;

            // Check if entire topic set is bookmarked
            const isTopicBookmarked =
              !!bookmarks[`part4-${topic.id}`] ||
              !!bookmarks[`part5-${topic.id}`] ||
              !!bookmarks[topic.id];

            return (
              <div key={topic.key} className="space-y-1.5">
                {selectedPart !== '2-3' && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleTopicClick(topic)}
                      className="flex-1 text-left text-xs font-extrabold transition-colors hover:text-[#2563eb] truncate focus:outline-none"
                      style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}
                      title={topic.name}
                    >
                      {topic.name}
                    </button>

                    <button
                      onClick={() => toggleTopic(topic.key)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                )}

                {(isExpanded || selectedPart === '2-3') && (
                  <>
                    {selectedPart === '2-3' ? (
                      <div className="space-y-1.5 pt-0.5">
                        {topic.items.map((item) => {
                          const ans = userAnswers[item.id];
                          const isAnswered =
                            ans !== undefined &&
                            ans !== null &&
                            ans !== '' &&
                            (!Array.isArray(ans) || ans.length > 0);

                          const isItemFlagged = isTopicBookmarked || !!bookmarks[item.id];

                          if (filterBookmarked && !isItemFlagged) return null;

                          let btnBg = isDarkMode ? '#1e293b' : '#ffffff';
                          let btnBorder = isDarkMode ? '#334155' : '#cbd5e1';
                          let btnTextColor = isDarkMode ? '#cbd5e1' : '#0f172a';

                          if (isAnswered) {
                            btnBg = '#2563eb';
                            btnBorder = '#2563eb';
                            btnTextColor = '#ffffff';
                          }

                          if (isItemFlagged) {
                            btnBg = 'rgba(244, 63, 94, 0.15)';
                            btnBorder = '#f43f5e';
                            btnTextColor = isDarkMode ? '#fda4af' : '#e11d48';
                          }

                          return (
                            <button
                              key={item.id}
                              onClick={() => handleItemClick(topic, item)}
                              className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-between transition-all shadow-2xs focus:outline-none hover:scale-[1.01]"
                              style={{
                                backgroundColor: btnBg,
                                borderColor: btnBorder,
                                color: btnTextColor
                              }}
                            >
                              <span className="truncate flex-1">
                                {item.label}. {item.title || `Set ${item.label}`}
                              </span>
                              {isItemFlagged && (
                                <Flag className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0 ml-2" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-2 pt-1">
                        {topic.items.map((item) => {
                          const ans = userAnswers[item.id];
                          const isAnswered =
                            ans !== undefined &&
                            ans !== null &&
                            ans !== '' &&
                            (!Array.isArray(ans) || ans.length > 0);

                          const isItemFlagged = isTopicBookmarked || !!bookmarks[item.id];
                          const isActive = item.id === currentSetId;

                          if (filterBookmarked && !isItemFlagged) return null;

                          let btnBg = isDarkMode ? '#1e293b' : '#ffffff';
                          let btnBorder = isDarkMode ? '#334155' : '#cbd5e1';
                          let btnTextColor = isDarkMode ? '#cbd5e1' : '#0f172a';

                          if (isAnswered) {
                            btnBg = '#2563eb';
                            btnBorder = '#2563eb';
                            btnTextColor = '#ffffff';
                          }

                          if (isItemFlagged) {
                            btnBg = 'rgba(244, 63, 94, 0.15)';
                            btnBorder = '#f43f5e';
                            btnTextColor = isDarkMode ? '#fda4af' : '#e11d48';
                          }

                          if (isActive && !isAnswered && !isItemFlagged) {
                            btnBg = isDarkMode ? '#334155' : '#e2e8f0';
                            btnBorder = isDarkMode ? '#64748b' : '#94a3b8';
                            btnTextColor = isDarkMode ? '#ffffff' : '#0f172a';
                          }

                          return (
                            <button
                              key={item.id}
                              onClick={() => handleItemClick(topic, item)}
                              className="w-9 h-9 rounded-xl text-xs font-extrabold border flex items-center justify-center transition-all shadow-2xs focus:outline-none hover:scale-105"
                              style={{
                                backgroundColor: btnBg,
                                borderColor: btnBorder,
                                color: btnTextColor
                              }}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Refactored Reusable NavigatorActionButtons Component */}
        <NavigatorActionButtons
          flaggedCount={flaggedCount}
          filterBookmarked={filterBookmarked}
          onToggleFilterBookmarked={() => setFilterBookmarked(!filterBookmarked)}
          onSubmitAll={onSubmitAll}
          isDarkMode={isDarkMode}
        />
      </div>
    </aside>
  );
}
