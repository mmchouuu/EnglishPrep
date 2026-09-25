import React, { useState, useMemo } from 'react';
import { Flag, Search, ChevronDown, X } from 'lucide-react';
import ReadingTimerProgressWidget from '../reading/ReadingTimerProgressWidget';
import NavigatorActionButtons from '../common/NavigatorActionButtons';
import { MobileDraggableNavigatorWidget } from '../common/MobileDraggableNavigatorWidget';

export const ListeningNavigator = ({
  part = 1,
  data = [],
  groups = [],
  activeGroup = null,
  currentIndex = 0,
  currentSetIndex = 0,
  onSelectIndex,
  onSelectSet,
  onSelectGroup,
  userAnswers = {},
  markedQuestions = {},
  submittedQuestions = {},
  setSubmittedState = {},
  onReviewFlagged,
  onSubmitAll,
  mode = 'full',
  isDarkMode = false
}) => {
  const [jumpInput, setJumpInput] = useState('');
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleTopic = (key) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  // Group data into topic accordions (Referencing Reading Part 4 & 5 UI layout)
  const topicGroups = useMemo(() => {
    if (!data || data.length === 0) return [];

    const formatTopicTitle = (raw) => {
      if (!raw) return 'General';
      const topicMap = {
        'activities_events_details': 'Activities, Events & Details',
        'numbers_money_codes': 'Numbers, Money & Codes',
        'objects_descriptions': 'Objects & Descriptions',
        'people_relationships': 'People & Relationships',
        'places_directions': 'Places & Directions',
        'reasons_opinions_purpose': 'Reasons, Opinions & Purpose',
        'time_date_duration': 'Time, Date & Duration',
        'travel_transport_mode': 'Travel & Transport'
      };
      if (topicMap[raw]) return topicMap[raw];

      // Preserve full topic title including set numbers e.g. "Protect the environment 1"
      let cleaned = String(raw).trim();
      cleaned = cleaned.replace(/^listening\s+part\s+\d+:?\s*/i, '');
      cleaned = cleaned.replace(/^listening\s+practice\s+set\s*\([^)]*\):?\s*/i, '');
      cleaned = cleaned.replace(/_/g, ' ');
      if (cleaned === cleaned.toLowerCase()) {
        cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
      }
      return cleaned || 'General';
    };

    if (part === 1) {
      if (groups && groups.length > 0) {
        return groups.map((g, gIdx) => {
          const groupKey = g.group_key;
          const gName = formatTopicTitle(g.name || g.group_key || `Group ${gIdx + 1}`);

          const matchedItems = (data || [])
            .map((q, idx) => ({ ...q, globalIdx: idx }))
            .filter(q => 
              (groupKey && q.groupKey === groupKey) || 
              (groupKey && q.metadata?.group_key === groupKey) ||
              (groupKey && q.sourceKey && q.sourceKey.toLowerCase().includes(groupKey.toLowerCase())) ||
              (gName && q.topic && q.topic.toLowerCase().includes(gName.toLowerCase()))
            );

          const chunkSize = Math.max(1, Math.ceil((data || []).length / groups.length));
          const fallbackItems = (data || [])
            .slice(gIdx * chunkSize, (gIdx + 1) * chunkSize)
            .map((q, idx) => ({ ...q, globalIdx: gIdx * chunkSize + idx }));

          const finalItems = matchedItems.length > 0 ? matchedItems : fallbackItems;

          return {
            key: groupKey || `p1-topic-${gIdx}`,
            groupKey,
            gIdx,
            name: gName,
            items: finalItems
          };
        });
      }

      const groupsMap = new Map();
      (data || []).forEach((q, idx) => {
        let rawTopic = q.topic || q.metadata?.topic || 'Short Conversations';
        const cleanName = formatTopicTitle(rawTopic);
        if (!groupsMap.has(cleanName)) {
          groupsMap.set(cleanName, []);
        }
        groupsMap.get(cleanName).push({ ...q, globalIdx: idx });
      });

      return Array.from(groupsMap.entries()).map(([name, items], gIdx) => ({
        key: `p1-topic-${gIdx}`,
        groupKey: items[0]?.groupKey || items[0]?.metadata?.group_key,
        gIdx,
        name,
        items
      }));
    }

    if (part === 2 || part === 3) {
      const groupsMap = new Map();
      (data || []).forEach((s, setIdx) => {
        let rawTopic = s.topic || s.topicName || s.title || (part === 2 ? 'Information Matching' : 'Opinion Matching');
        const cleanName = formatTopicTitle(rawTopic);
        if (!groupsMap.has(cleanName)) {
          groupsMap.set(cleanName, []);
        }

        const subItems = part === 2 ? (s.items || []) : (s.statements || []);
        subItems.forEach((sub, subIdx) => {
          const subId = sub.id || `${s.id || setIdx}_item_${subIdx + 1}`;
          groupsMap.get(cleanName).push({
            id: subId,
            setId: s.id,
            setIdx,
            globalSetIdx: setIdx,
            qNum: sub.questionNumber || (subIdx + 1),
            rawItem: sub
          });
        });
      });

      return Array.from(groupsMap.entries()).map(([name, items], gIdx) => ({
        key: `p${part}-topic-${gIdx}`,
        gIdx,
        name,
        items
      }));
    }

    if (part === 4) {
      if (Array.isArray(data) && data[0]?.sets) {
        let globalSetCounter = 0;
        return data.map((tg, gIdx) => {
          const itemsList = [];
          (tg.sets || []).forEach((s) => {
            const currentSetIndexVal = globalSetCounter++;
            (s.questions || []).forEach((q, qIdx) => {
              const qId = q.id || `${s.id || currentSetIndexVal}_q_${qIdx + 1}`;
              itemsList.push({
                id: qId,
                setId: s.id,
                setIdx: currentSetIndexVal,
                globalSetIdx: currentSetIndexVal,
                qNum: q.questionNumber || (qIdx + 1),
                rawItem: q
              });
            });
          });

          return {
            key: tg.topicId || `p4-topic-${gIdx}`,
            gIdx,
            name: formatTopicTitle(tg.topicName || `Topic ${gIdx + 1}`),
            items: itemsList
          };
        });
      }
    }

    return [
      {
        key: 'default-group',
        gIdx: 0,
        name: `Listening Part ${part}`,
        items: (data || []).map((d, i) => ({ ...d, globalIdx: i, globalSetIdx: i }))
      }
    ];
  }, [data, part]);

  // Flattened items for Prev / Next navigation
  const allFlatItems = useMemo(() => {
    const flat = [];
    topicGroups.forEach((tg) => {
      tg.items.forEach((item) => {
        flat.push({ topic: tg, item });
      });
    });
    return flat;
  }, [topicGroups]);

  const activeIndex = part === 1 ? currentIndex : currentSetIndex;
  const totalCount = allFlatItems.length || data.length;

  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < totalCount - 1;

  const handlePrev = () => {
    if (!hasPrev) return;
    const newIdx = activeIndex - 1;
    if (part === 1 && onSelectIndex) {
      onSelectIndex(newIdx);
    } else if (onSelectSet) {
      onSelectSet(newIdx);
    }
  };

  const handleNext = () => {
    if (!hasNext) return;
    const newIdx = activeIndex + 1;
    if (part === 1 && onSelectIndex) {
      onSelectIndex(newIdx);
    } else if (onSelectSet) {
      onSelectSet(newIdx);
    }
  };

  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalCount) {
      if (part === 1 && onSelectIndex) {
        onSelectIndex(num - 1);
      } else if (onSelectSet) {
        onSelectSet(Math.min(num - 1, totalCount - 1));
      }
      setJumpInput('');
    }
  };

  const flaggedCount = Object.values(markedQuestions).filter(Boolean).length;
  const answeredCount = Object.keys(userAnswers).length;

  const titleText = useMemo(() => {
    if (part === 1) return 'Questions 1 – 13';
    if (part === 2) return 'Question 14';
    if (part === 3) return 'Question 15';
    if (part === 4) return 'Questions 16 – 17';
    return `Part ${part}`;
  }, [part]);

  // Shared Navigator Card Content component
  const renderNavigatorCardContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h3 className="text-sm sm:text-base font-extrabold tracking-tight" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          {titleText}
        </h3>
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Jump to question input */}
      <form onSubmit={handleJump} className="space-y-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="e.g. 25"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            className="flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border outline-none transition-all focus:border-blue-500"
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
              borderColor: isDarkMode ? '#334155' : '#cbd5e1',
              color: isDarkMode ? '#ffffff' : '#0f172a'
            }}
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1 shrink-0"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Go</span>
          </button>
        </div>
      </form>

      {/* Status Legend */}
      <div
        className="flex items-center justify-between text-[11px] font-semibold py-1.5 border-y shrink-0"
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
          <span>Not answered</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[#2563eb]" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border border-rose-500 bg-rose-500/20" />
          <span>Flagged</span>
        </div>
      </div>

      {/* Topic Accordions List */}
      <div className="space-y-3 flex-1 overflow-y-auto overflow-x-hidden pr-1 min-h-[140px] max-h-[calc(100vh-20rem)]">
        {topicGroups.map((topic) => {
          const isExpanded = expandedTopics[topic.key] !== false;

          return (
            <div key={topic.key} className="space-y-1.5">
              {/* Topic Accordion Header */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleTopic(topic.key)}
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

              {/* Topic Items Grid */}
              {isExpanded && (
                <div className="grid grid-cols-7 gap-2 pt-1">
                  {topic.items.map((item, idx) => {
                    const itemIdx = part === 1 ? item.globalIdx : (item.setIdx !== undefined ? item.setIdx : item.globalSetIdx);
                    const qDisplayNum = item.qNum || (idx + 1);
                    const itemId = item?.id || itemIdx;
                    const isActive = item.setIdx !== undefined ? item.setIdx === currentSetIndex : itemIdx === activeIndex;
                    const isFlagged = !!markedQuestions[itemId] || (item.setId ? !!markedQuestions[item.setId] : false);
                    const ansKey = `${itemId}_p1`;
                    const isAns = (userAnswers[ansKey] !== undefined && userAnswers[ansKey] !== '') ||
                      (userAnswers[itemId] !== undefined && userAnswers[itemId] !== '') ||
                      !!submittedQuestions[itemId] ||
                      (item.setId ? !!submittedQuestions[item.setId] : false);

                    if (filterBookmarked && !isFlagged) return null;

                    let btnBg = isDarkMode ? '#1e293b' : '#ffffff';
                    let btnBorder = isDarkMode ? '#334155' : '#cbd5e1';
                    let btnTextColor = isDarkMode ? '#cbd5e1' : '#0f172a';

                    if (isAns) {
                      btnBg = '#2563eb';
                      btnBorder = '#2563eb';
                      btnTextColor = '#ffffff';
                    }

                    if (isFlagged) {
                      btnBg = 'rgba(244, 63, 94, 0.15)';
                      btnBorder = '#f43f5e';
                      btnTextColor = isDarkMode ? '#fda4af' : '#e11d48';
                    }

                    if (isActive && !isAns && !isFlagged) {
                      btnBg = isDarkMode ? '#334155' : '#e2e8f0';
                      btnBorder = isDarkMode ? '#64748b' : '#94a3b8';
                      btnTextColor = isDarkMode ? '#ffffff' : '#0f172a';
                    }

                    return (
                      <button
                        key={`${itemId}-${qDisplayNum}`}
                        onClick={() => {
                          if (topic.groupKey && onSelectGroup) {
                            onSelectGroup(topic.groupKey);
                          }
                          if (part === 1 && onSelectIndex) onSelectIndex(item.globalIdx !== undefined ? item.globalIdx : itemIdx);
                          else if (onSelectSet) onSelectSet(item.setIdx !== undefined ? item.setIdx : item.globalSetIdx);

                          setIsMobileOpen(false);

                          // Smooth scroll to target element
                          const targetEl = document.getElementById(`question-${itemId}`) || document.getElementById(`set-${item.setId || itemId}`);
                          if (targetEl) {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                        className="w-9 h-9 rounded-xl text-xs font-extrabold border flex items-center justify-center transition-all focus:outline-none min-w-0 hover:scale-105 shadow-2xs"
                        style={{
                          backgroundColor: btnBg,
                          borderColor: btnBorder,
                          color: btnTextColor
                        }}
                      >
                        {qDisplayNum}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Refactored Reusable NavigatorActionButtons Component */}
      <NavigatorActionButtons
        flaggedCount={flaggedCount}
        filterBookmarked={filterBookmarked}
        onToggleFilterBookmarked={() => {
          setFilterBookmarked(!filterBookmarked);
          if (onReviewFlagged) onReviewFlagged();
        }}
        onSubmitAll={() => {
          setIsMobileOpen(false);
          if (onSubmitAll) onSubmitAll();
        }}
        isDarkMode={isDarkMode}
      />
    </>
  );

  return (
    <>
      {/* 1. Mobile Draggable Floating Pill Widget (Right Edge) - Visible on lg:hidden */}
      <MobileDraggableNavigatorWidget
        onOpenDrawer={() => setIsMobileOpen(true)}
        answeredCount={answeredCount}
        totalCount={totalCount}
        timeStr="00:00:00"
        isDarkMode={isDarkMode}
      />

      {/* 2. Mobile Slide-Over Drawer Modal (Image 3) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div
            className="fixed inset-y-0 right-0 z-50 w-[88vw] max-w-sm shadow-2xl p-4 sm:p-5 flex flex-col space-y-3 overflow-y-auto animate-in slide-in-from-right duration-200"
            style={{
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#0f172a'
            }}
          >
            {/* Top Timer & Progress Widget inside mobile drawer */}
            <ReadingTimerProgressWidget
              timeStr="00:00:00"
              answeredCount={answeredCount}
              totalCount={totalCount}
              isDarkMode={isDarkMode}
            />

            {renderNavigatorCardContent()}
          </div>
        </div>
      )}

      {/* 3. Desktop Sidebar Navigator Layout - Visible on lg:block */}
      <aside className="hidden lg:block w-80 shrink-0 space-y-3 sticky top-20">
        <ReadingTimerProgressWidget
          timeStr="00:00:00"
          answeredCount={answeredCount}
          totalCount={totalCount}
          isDarkMode={isDarkMode}
        />

        <div
          className="p-4 sm:p-5 rounded-2xl border transition-all flex flex-col max-h-[calc(100vh-10rem)] shadow-xs space-y-3 overflow-hidden"
          style={{
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
            color: isDarkMode ? '#ffffff' : '#0f172a'
          }}
        >
          {renderNavigatorCardContent()}
        </div>
      </aside>
    </>
  );
};

