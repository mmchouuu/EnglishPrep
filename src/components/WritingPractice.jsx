import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import {
  Check,
  CheckCircle,
  Flag,
  Send,
  Search,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  Database,
  ShieldAlert,
  LogIn,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

import PartSelector from './reading/PartSelector';
import PracticeModeSelector from './reading/PracticeModeSelector';
import ReadingTimerProgressWidget from './reading/ReadingTimerProgressWidget';
import BookmarkButton from './reading/BookmarkButton';
import TopicHeaderBanner from './reading/TopicHeaderBanner';
import NavigatorActionButtons from './common/NavigatorActionButtons';
import { AIEvaluationModal } from './common/AIEvaluationModal';
import { InlineEvaluationCard } from './common/InlineEvaluationCard';


import { useWritingPractice } from '../hooks/useWritingPractice';

import { countWords } from '../adapters/writingAdapter';

const writingParts = [
  { id: '1', label: 'Part 1', sublabel: 'Word-level Responses' },
  { id: '2', label: 'Part 2', sublabel: 'Short Text' },
  { id: '3', label: 'Part 3', sublabel: 'Chat Responses' },
  { id: '4', label: 'Part 4', sublabel: 'Email Writing' }
];

export const WritingPractice = ({ isDarkMode = false }) => {
  const { partId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Validate active part (1, 2, 3, 4)
  const selectedPart = useMemo(() => {
    if (partId === 'part-2' || partId === '2') return 2;
    if (partId === 'part-3' || partId === '3') return 3;
    if (partId === 'part-4' || partId === '4') return 4;
    return 1;
  }, [partId]);

  const currentMode = searchParams.get('mode') === 'club' ? 'byClub' : 'byPart';
  const groupParam = searchParams.get('group');
  const paramIndex = parseInt(searchParams.get('index') || '1', 10);

  const [jumpInput, setJumpInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Real Supabase Data & Auth Hook for Writing Phase 6B3
  const {
    authStatus,
    authUser,
    loading,
    error,
    isEmpty,
    groups,
    activeGroup,
    rawQuestions,
    adaptedData,
    userAnswers,
    markedQuestions,
    submittedClubs,
    submitted,
    results,
    submitting,
    saveStatus,
    activeEvaluation,
    setActiveEvaluation,
    itemEvaluations,
    handleTextChange,
    handleToggleMark,
    handleClubSubmit,
    handleSubmitSingleQuestion,
    handleConfirmSubmit


  } = useWritingPractice({
    activePart: selectedPart,
    practiceMode: currentMode,
    groupKeyParam: groupParam
  });

  // Exercises/Clubs list derived from adapted DB data
  const partQuestions = useMemo(() => {
    return Array.isArray(adaptedData) ? adaptedData : [];
  }, [adaptedData]);

  const currentIndex = useMemo(() => {
    const idx = paramIndex - 1;
    return Math.max(0, Math.min(idx, Math.max(0, partQuestions.length - 1)));
  }, [paramIndex, partQuestions.length]);

  const currentQ = partQuestions[currentIndex] || partQuestions[0];

  const displayClubs = useMemo(() => {
    if (currentMode === 'byClub') {
      return currentQ ? [currentQ] : [];
    }
    return partQuestions;
  }, [currentMode, currentQ, partQuestions]);

  // Navigation handlers preserving search query params
  const handlePartSelect = (pId) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('index', '1');
    navigate(`/writing/part-${pId}?${newParams.toString()}`);
  };

  const handleModeSelect = (mVal) => {
    const newParams = new URLSearchParams(searchParams);
    if (mVal === 'topic' || mVal === 'byClub') {
      newParams.set('mode', 'club');
      if (groups.length > 0 && !newParams.get('group')) {
        newParams.set('group', groups[0].group_key);
      }
    } else {
      newParams.delete('mode');
      newParams.delete('group');
    }
    newParams.set('index', '1');
    setSearchParams(newParams);
  };

  const isNavigatingRef = React.useRef(false);

  const handleSelectIndex = (idx) => {
    isNavigatingRef.current = true;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('index', String(idx + 1));
    if (currentMode === 'byClub' && partQuestions[idx]?.groupKey) {
      newParams.set('group', partQuestions[idx].groupKey);
    }
    setSearchParams(newParams);

    const el = document.getElementById(`writing-club-${idx}`) || document.getElementById('writing-main-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => { isNavigatingRef.current = false; }, 800);
  };

  // ScrollSpy: Update active index on scroll
  useEffect(() => {
    if (loading || !partQuestions || partQuestions.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isNavigatingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idxAttr = entry.target.getAttribute('data-scroll-index');
            if (idxAttr !== null) {
              const idx = parseInt(idxAttr, 10);
              if (!isNaN(idx) && idx !== currentIndex) {
                const newParams = new URLSearchParams(window.location.search);
                newParams.set('index', String(idx + 1));
                if (currentMode === 'byClub' && partQuestions[idx]?.groupKey) {
                  newParams.set('group', partQuestions[idx].groupKey);
                }
                setSearchParams(newParams, { replace: true });
              }
            }
          }
        });
      },
      { rootMargin: '-20% 0px -50% 0px', threshold: 0.2 }
    );

    const elements = document.querySelectorAll('[data-scroll-index]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [loading, partQuestions, currentIndex, currentMode, setSearchParams]);

  const handleSaveDraftLocal = (clubId) => {
    confetti({ particleCount: 20, spread: 40, origin: { y: 0.8 } });
  };

  const handleClubSubmitLocal = (clubId, questionId, textVal, qMeta = {}) => {
    const qKey = questionId || currentQ?.id;
    handleClubSubmit(clubId || currentQ?.groupKey || currentQ?.id);
    handleSubmitSingleQuestion(qKey, { text: textVal }, qMeta);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
  };


  const onModalSubmit = async () => {
    await handleConfirmSubmit();
    setShowSubmitModal(false);
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.7 } });
  };

  const handleReviewFlagged = () => {
    const flaggedKeys = Object.keys(markedQuestions).filter((k) => markedQuestions[k]);
    if (flaggedKeys.length === 0) {
      alert('No flagged items for review.');
    } else {
      alert(`You have ${flaggedKeys.length} flagged item(s) to review.`);
    }
  };

  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(jumpInput, 10);
    if (!isNaN(num) && num >= 1 && num <= partQuestions.length) {
      handleSelectIndex(num - 1);
      setJumpInput('');
    }
  };

  const flaggedCount = useMemo(() => {
    return Object.values(markedQuestions).filter(Boolean).length;
  }, [markedQuestions]);

  const answeredCount = useMemo(() => {
    return Object.keys(userAnswers).filter((k) => userAnswers[k] && String(userAnswers[k]).trim() !== '').length;
  }, [userAnswers]);

  const currentReturnUrl = encodeURIComponent(location.pathname + location.search);

  // Color theme tokens matching reference images writing-p1..p4 cleanly
  const theme = useMemo(() => {
    if (isDarkMode) {
      return {
        cardBg: '#111827',
        cardBorder: '#29364a',
        titleColor: '#ffffff',
        bodyText: '#cbd5e1',
        subText: '#94a3b8',
        promptText: '#f1f5f9',
        inputBg: '#1e293b',
        inputBorder: '#334155',
        inputText: '#ffffff',
        itemBg: '#1e293b',
        itemBorder: '#334155',
        badgePillBg: '#1e3a8a',
        badgePillText: '#93c5fd',
        badgePillBorder: '#1d4ed8',
        numCircleBg: '#1e293b',
        numCircleText: '#cbd5e1',
        numCircleBorder: '#334155',
        calloutBg: 'rgba(30, 58, 138, 0.25)',
        calloutBorder: 'rgba(59, 130, 246, 0.4)',
        chatBubbleBg: '#1e293b',
        chatBubbleBorder: '#334155',
        badgeValidBg: 'rgba(16, 185, 129, 0.15)',
        badgeValidText: '#34d399',
        badgeValidBorder: 'rgba(16, 185, 129, 0.3)',
        trackBg: '#334155',
        btnSecondaryBg: '#1e293b',
        btnSecondaryBorder: '#334155',
        btnSecondaryText: '#cbd5e1',
      };
    }
    return {
      cardBg: '#ffffff',
      cardBorder: '#d8e2ef',
      titleColor: '#0f172a',
      bodyText: '#334155',
      subText: '#64748b',
      promptText: '#0f172a',
      inputBg: '#ffffff',
      inputBorder: '#cbd5e1',
      inputText: '#0f172a',
      itemBg: '#ffffff',
      itemBorder: '#e2e8f0',
      badgePillBg: '#eff6ff',
      badgePillText: '#2563eb',
      badgePillBorder: '#bfdbfe',
      numCircleBg: '#f1f5f9',
      numCircleText: '#334155',
      numCircleBorder: '#cbd5e1',
      calloutBg: '#eff6ff',
      calloutBorder: '#bfdbfe',
      chatBubbleBg: '#f8fafc',
      chatBubbleBorder: '#e2e8f0',
      badgeValidBg: '#ecfdf5',
      badgeValidText: '#16a34a',
      badgeValidBorder: '#a7f3d0',
      trackBg: '#e2e8f0',
      btnSecondaryBg: '#f8fafc',
      btnSecondaryBorder: '#cbd5e1',
      btnSecondaryText: '#475569',
    };
  }, [isDarkMode]);

  return (
    <div
      className={`min-h-screen pb-12 transition-colors ${isDarkMode ? 'bg-[#090d16] text-slate-100' : 'bg-[#f4f7fc] text-[#0f172a]'
        }`}
    >
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Top Header Section + Save Status Indicator */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs font-extrabold text-[#2563eb] tracking-wider uppercase block">
              WRITING PRACTICE (SUPABASE DATA)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            {authStatus === 'authenticated' && saveStatus === 'saving' && (
              <span className="text-amber-500 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving draft...
              </span>
            )}
            {authStatus === 'authenticated' && saveStatus === 'saved' && (
              <span className="text-emerald-500 flex items-center gap-1">
                ✓ Draft saved
              </span>
            )}
            {authStatus === 'authenticated' && saveStatus === 'error' && (
              <span className="text-rose-500 flex items-center gap-1">
                ⚠ Autosave offline
              </span>
            )}
          </div>
        </div>

        {/* Top Control Bar: PartSelector & PracticeModeSelector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex-1">
            <PartSelector
              parts={writingParts}
              selectedPart={String(selectedPart)}
              onSelectPart={(pId) => handlePartSelect(pId)}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="flex items-center gap-4 shrink-0 flex-wrap">
            <PracticeModeSelector
              selectedPart={String(selectedPart)}
              selectedMode={currentMode === 'byClub' ? 'topic' : 'full'}
              onSelectMode={(mVal) => handleModeSelect(mVal)}
              hasTopics={true}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* State 1: Auth Loading */}
        {authStatus === 'loading' && (
          <div
            className={`p-12 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
              }`}
          >
            <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin mx-auto" />
            <p className="text-sm font-bold">Verifying authentication session...</p>
          </div>
        )}

        {/* State 2: Unauthenticated User -> Auth Required State */}
        {authStatus === 'unauthenticated' && (
          <div
            className={`p-10 md:p-14 rounded-2xl border text-center space-y-5 shadow-lg ${isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-extrabold tracking-tight">Authentication Required</h3>
              <p className="text-xs leading-relaxed" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                Supabase Row Level Security (RLS) requires an authenticated user session to access Aptis Writing practice questions and save drafts. Please sign in to continue.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <Link
                to={`/login?redirectTo=${currentReturnUrl}`}
                className="px-6 py-3 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-md shadow-blue-500/20 inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Create Account</span>
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Authenticated & Loading Data */}
        {authStatus === 'authenticated' && loading && (
          <div
            className={`p-12 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
              }`}
          >
            <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin mx-auto" />
            <p className="text-sm font-bold">Loading Writing Part {selectedPart} questions from Supabase...</p>
          </div>
        )}

        {/* State 4: Error State */}
        {authStatus === 'authenticated' && !loading && error && (
          <div
            className={`p-8 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
          >
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-extrabold">Failed to load Writing data</h3>
            <p className="text-xs max-w-lg mx-auto leading-relaxed">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* State 5: Authenticated but Database really has 0 rows */}
        {authStatus === 'authenticated' && !loading && !error && (isEmpty || !currentQ) && (
          <div
            className={`p-12 rounded-2xl border text-center space-y-4 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
              }`}
          >
            <Database className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-base font-extrabold">No questions found</h3>
            <p className="text-xs">No questions exist for Writing Part {selectedPart} in database.</p>
          </div>
        )}

        {/* State 6: Authenticated & Data Ready -> Render Workspace */}
        {authStatus === 'authenticated' && !loading && !error && !isEmpty && currentQ && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* Left Column: Main Content Area matching reference screenshots */}
            <div className="flex-1 w-full space-y-6">

              {/* ================= PART 1: WORD-LEVEL RESPONSES (writing-p1.png) ================= */}
              {selectedPart === 1 && (
                <div className="space-y-12">
                  {displayClubs.map((clubObj, cIdx) => {
                    const currentQ = clubObj;
                    return (
                      <div key={currentQ.id || currentQ.groupKey || cIdx} id={`writing-club-${cIdx}`} data-scroll-index={cIdx} className="space-y-6 scroll-mt-24">
                        {/* Topic Header Banner rendered OUTSIDE white card matching Hình 1 */}
                        <TopicHeaderBanner
                          topicName={currentQ.clubName || currentQ.topic || 'PHOTOGRAPHY CLUB'}
                          setInfo={`${currentQ.questions?.length || 5} questions`}
                          isDarkMode={isDarkMode}
                        />

                        <div
                          id={`writing-main-card-${cIdx}`}
                          className="p-6 rounded-2xl border space-y-6 shadow-xs"
                          style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        >
                          {/* List of 5 Questions */}
                          <div className="space-y-3.5">
                            {(currentQ.questions || []).map((qObj, pIdx) => {
                              const qNum = pIdx + 1;
                              const fieldKey = `p1_q${pIdx}`;
                              const itemKey = `${currentQ.id}_${fieldKey}`;
                              const qIdKey = qObj.id || itemKey;
                              const val = userAnswers[itemKey] || userAnswers[qIdKey] || '';
                              const wCount = countWords(val);
                              const minReq = qObj.minWords || 1;
                              const maxReq = qObj.maxWords || 5;
                              const isValid = wCount >= minReq && wCount <= maxReq;
                              const isFlagged = markedQuestions[itemKey] || markedQuestions[qIdKey];

                              return (
                                <div key={qObj.id || pIdx} className="space-y-3">
                                  <div
                                    className="p-4 rounded-xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-all"
                                    style={{
                                      backgroundColor: theme.itemBg,
                                      borderColor: theme.itemBorder
                                    }}
                                  >
                                    <div className="flex items-center gap-3 md:w-1/3 shrink-0">
                                      <span
                                        className="w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 border"
                                        style={{
                                          backgroundColor: theme.numCircleBg,
                                          borderColor: theme.numCircleBorder,
                                          color: theme.numCircleText
                                        }}
                                      >
                                        {qNum}
                                      </span>
                                      <span className="text-xs font-bold" style={{ color: theme.bodyText }}>
                                        {qObj.prompt.replace(/^\d+\.\s*/, '')}
                                      </span>
                                    </div>

                                    <div className="flex-1 flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => handleTextChange(qIdKey, null, e.target.value)}
                                        placeholder="Type your answer here..."
                                        className="flex-1 px-3.5 py-2 rounded-xl text-xs font-semibold border outline-none transition-all focus:border-blue-500"
                                        style={{
                                          backgroundColor: theme.inputBg,
                                          borderColor: theme.inputBorder,
                                          color: theme.inputText
                                        }}
                                      />
                                      {/* Word count badge */}
                                      <span
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 shrink-0 border"
                                        style={{
                                          backgroundColor: isValid ? theme.badgeValidBg : isDarkMode ? '#1e293b' : '#f1f5f9',
                                          color: isValid ? theme.badgeValidText : wCount > maxReq ? '#ef4444' : theme.subText,
                                          borderColor: isValid ? theme.badgeValidBorder : '#cbd5e1'
                                        }}
                                      >
                                        {isValid && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                        <span>{wCount} / {maxReq} words</span>
                                      </span>
                                    </div>

                                    {/* Row actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <BookmarkButton
                                        isBookmarked={isFlagged}
                                        onToggle={() => handleToggleMark(qIdKey)}
                                        label="Mark"
                                        isDarkMode={isDarkMode}
                                      />
                                      <button
                                        onClick={() => handleSaveDraftLocal(currentQ.clubName)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                                        style={{
                                          backgroundColor: theme.btnSecondaryBg,
                                          borderColor: theme.btnSecondaryBorder,
                                          color: theme.btnSecondaryText
                                        }}
                                      >
                                        Save draft
                                      </button>
                                      <button
                                        onClick={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: qObj.prompt, modelAnswer: qObj.modelAnswer, minWords: minReq, maxWords: maxReq, partNumber: 1 })}
                                        className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        <span>Check this response</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inline Evaluation Result Box */}
                                  <InlineEvaluationCard
                                    evaluation={itemEvaluations[qIdKey] || itemEvaluations[qObj.id] || itemEvaluations[currentQ.id]}
                                    userAnswerText={val}
                                    onRecheck={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: qObj.prompt, modelAnswer: qObj.modelAnswer, minWords: minReq, maxWords: maxReq, partNumber: 1 })}
                                    isDarkMode={isDarkMode}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ================= PART 2: SHORT TEXT (writing-p2.png) ================= */}
              {selectedPart === 2 && (
                <div className="space-y-12">
                  {displayClubs.map((clubObj, cIdx) => {
                    const currentQ = clubObj;
                    const activeClubIdx = currentMode === 'byClub' ? currentIndex : cIdx;
                    return (
                      <div key={currentQ.id || currentQ.groupKey || cIdx} id={`writing-club-${cIdx}`} data-scroll-index={cIdx} className="space-y-6 scroll-mt-24">
                        {/* Topic Header Banner rendered OUTSIDE white card matching Hình 1 */}
                        <TopicHeaderBanner
                          topicName={currentQ.clubName || currentQ.groupName || 'TRAVEL CLUB'}
                          setInfo={`Club ${activeClubIdx + 1} of ${partQuestions.length}`}
                          isDarkMode={isDarkMode}
                        />

                        <div
                          id={`writing-main-card-${cIdx}`}
                          className="p-6 rounded-2xl border space-y-5 shadow-xs"
                          style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        >
                          {/* Club Message Callout Box */}
                          <div
                            className="p-4 rounded-xl border space-y-1.5"
                            style={{
                              backgroundColor: theme.calloutBg,
                              borderColor: theme.calloutBorder
                            }}
                          >
                            <div className="flex items-center gap-2 text-xs font-extrabold text-[#2563eb]">
                              <MessageSquare className="w-4 h-4" />
                              <span>Club message:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {currentQ.instruction || "We'd love to hear about your experiences!"}
                              </span>
                            </div>
                            <p className="text-sm font-extrabold pt-1" style={{ color: theme.promptText }}>
                              {currentQ.prompt}
                            </p>
                          </div>

                          {/* Textarea Card */}
                          {(() => {
                            const qIdKey = currentQ.question?.id || currentQ.id;
                            const val = userAnswers[qIdKey] || userAnswers[`${qIdKey}_p2`] || '';
                            const wCount = countWords(val);
                            const minReq = currentQ.minWords || 20;
                            const maxReq = currentQ.maxWords || 30;
                            const isMet = wCount >= minReq && wCount <= maxReq;
                            const progressPct = Math.min(100, Math.round((wCount / maxReq) * 100));

                            return (
                              <div className="space-y-3">
                                <textarea
                                  rows={5}
                                  value={val}
                                  onChange={(e) => handleTextChange(qIdKey, null, e.target.value)}
                                  placeholder="Start writing your answer here..."
                                  className="w-full p-4 rounded-xl text-xs font-medium border outline-none transition-all focus:border-blue-500 leading-relaxed"
                                  style={{
                                    backgroundColor: theme.inputBg,
                                    borderColor: theme.inputBorder,
                                    color: theme.inputText
                                  }}
                                />

                                {/* Progress Bar & Word Counter Row */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span
                                      className="text-xs font-extrabold shrink-0"
                                      style={{ color: isMet ? '#16a34a' : '#2563eb' }}
                                    >
                                      {wCount} / {maxReq} words
                                    </span>

                                    <div
                                      className="flex-1 h-2.5 rounded-full overflow-hidden"
                                      style={{ backgroundColor: theme.trackBg }}
                                    >
                                      <div
                                        className={`h-full transition-all duration-300 ${isMet ? 'bg-[#22c55e]' : 'bg-[#2563eb]'
                                          }`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>

                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                      Required: {minReq}–{maxReq} words
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 justify-end">
                                    {isMet && (
                                      <span
                                        className="px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 border"
                                        style={{
                                          backgroundColor: theme.badgeValidBg,
                                          color: theme.badgeValidText,
                                          borderColor: theme.badgeValidBorder
                                        }}
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Requirement met</span>
                                      </span>
                                    )}

                                    <BookmarkButton
                                      isBookmarked={!!markedQuestions[qIdKey]}
                                      onToggle={() => handleToggleMark(qIdKey)}
                                      label="Mark"
                                      isDarkMode={isDarkMode}
                                    />

                                    <button
                                      onClick={() => handleSaveDraftLocal(currentQ.clubName)}
                                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                                      style={{
                                        backgroundColor: theme.btnSecondaryBg,
                                        borderColor: theme.btnSecondaryBorder,
                                        color: theme.btnSecondaryText
                                      }}
                                    >
                                      Save draft
                                    </button>

                                    <button
                                      onClick={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: currentQ.prompt || currentQ.instruction, modelAnswer: currentQ.modelAnswer || currentQ.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 2 })}
                                      className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1.5"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Check this response</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Inline Evaluation Card for Part 2 */}
                                <InlineEvaluationCard
                                  evaluation={itemEvaluations[qIdKey] || itemEvaluations[currentQ.id]}
                                  userAnswerText={val}
                                  onRecheck={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: currentQ.prompt || currentQ.instruction, modelAnswer: currentQ.modelAnswer || currentQ.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 2 })}
                                  isDarkMode={isDarkMode}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ================= PART 3: CHAT RESPONSES (writing-p3.png) ================= */}
              {selectedPart === 3 && (
                <div className="space-y-12">
                  {displayClubs.map((clubObj, cIdx) => {
                    const currentQ = clubObj;
                    return (
                      <div key={currentQ.id || currentQ.groupKey || cIdx} id={`writing-club-${cIdx}`} data-scroll-index={cIdx} className="space-y-6 scroll-mt-24">
                        {/* Topic Header Banner rendered OUTSIDE white card matching Hình 1 */}
                        <TopicHeaderBanner
                          topicName={currentQ.clubName || currentQ.groupName || 'MUSIC CLUB'}
                          setInfo={`${currentQ.questions?.length || 3} messages`}
                          isDarkMode={isDarkMode}
                        />

                        <div
                          id={`writing-main-card-${cIdx}`}
                          className="p-6 rounded-2xl border space-y-6 shadow-xs"
                          style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        >
                          {/* 3 Chat Items */}
                          <div className="space-y-6">
                            {(currentQ.questions || []).map((qObj, qIdx) => {
                              const qNum = qIdx + 1;
                              const fieldKey = `p3_q${qIdx}`;
                              const qIdKey = qObj.id || `${currentQ.id}_${fieldKey}`;
                              const val = userAnswers[fieldKey] || userAnswers[qIdKey] || '';
                              const wCount = countWords(val);
                              const minReq = qObj.minWords || 30;
                              const maxReq = qObj.maxWords || 40;
                              const isGood = wCount >= minReq && wCount <= maxReq;
                              const isLow = wCount > 0 && wCount < minReq;
                              const progressPct = Math.min(100, Math.round((wCount / maxReq) * 100));

                              const promptText = qObj.prompt || '';
                              const memberMatch = promptText.match(/^(Member\s+\w+|\w+):\s*(.*)/i);
                              const authorName = memberMatch ? memberMatch[1].replace(/^Member\s*/i, '') : `Member ${qNum}`;
                              const messageBody = memberMatch ? memberMatch[2] : promptText;
                              const initialChar = authorName.charAt(0).toUpperCase();

                              // Avatar colors matching screenshot 3
                              const avatarColors = [
                                { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' }, // Sarah purple
                                { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' }, // James blue
                                { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' }  // Maria green
                              ][qIdx % 3];

                              return (
                                <div key={qIdKey || qIdx} className="space-y-3">
                                  {/* Member Prompt Speech Bubble */}
                                  <div className="flex items-start gap-3">
                                    <span className="text-xs font-extrabold text-slate-400 mt-2 shrink-0">{qNum}.</span>

                                    <div
                                      className="w-8 h-8 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5 border"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e293b' : avatarColors.bg,
                                        borderColor: isDarkMode ? '#334155' : avatarColors.border,
                                        color: isDarkMode ? '#60a5fa' : avatarColors.text
                                      }}
                                    >
                                      {initialChar}
                                    </div>

                                    <div
                                      className="flex-1 p-3.5 rounded-2xl border space-y-1"
                                      style={{
                                        backgroundColor: theme.chatBubbleBg,
                                        borderColor: theme.chatBubbleBorder
                                      }}
                                    >
                                      <span className="text-xs font-extrabold block" style={{ color: theme.titleColor }}>
                                        {authorName}
                                      </span>
                                      <p className="text-xs font-medium leading-relaxed" style={{ color: theme.bodyText }}>
                                        {messageBody}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Response Textarea */}
                                  <div className="pl-11 space-y-2">
                                    <textarea
                                      rows={3}
                                      value={val}
                                      onChange={(e) => handleTextChange(qIdKey, null, e.target.value)}
                                      placeholder="Write your response here..."
                                      className="w-full p-3.5 rounded-xl text-xs font-medium border outline-none transition-all focus:border-blue-500 leading-relaxed"
                                      style={{
                                        backgroundColor: theme.inputBg,
                                        borderColor: theme.inputBorder,
                                        color: theme.inputText
                                      }}
                                    />

                                    {/* Status row under textarea */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                      <div className="flex items-center gap-3 flex-1">
                                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 shrink-0">
                                          {wCount} / {maxReq} words
                                        </span>

                                        <div
                                          className="flex-1 h-2.5 rounded-full overflow-hidden"
                                          style={{ backgroundColor: theme.trackBg }}
                                        >
                                          <div
                                            className={`h-full transition-all duration-300 ${isGood ? 'bg-[#22c55e]' : isLow ? 'bg-amber-500' : 'bg-slate-400'
                                              }`}
                                            style={{ width: `${progressPct}%` }}
                                          />
                                        </div>

                                        <span
                                          className="px-2 py-0.5 rounded text-[11px] font-extrabold flex items-center gap-1 shrink-0 border"
                                          style={{
                                            backgroundColor: isGood ? theme.badgeValidBg : isLow ? '#fef3c7' : isDarkMode ? '#1e293b' : '#f1f5f9',
                                            color: isGood ? theme.badgeValidText : isLow ? '#d97706' : theme.subText,
                                            borderColor: isGood ? theme.badgeValidBorder : isLow ? '#fde68a' : isDarkMode ? '#334155' : '#cbd5e1'
                                          }}
                                        >
                                          {isGood && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                          {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                                          <span>{isGood ? 'Within range' : isLow ? 'Below minimum' : 'Not started'}</span>
                                        </span>

                                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                          {minReq} – {maxReq} words required
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 justify-end">
                                        <BookmarkButton
                                          isBookmarked={!!markedQuestions[qIdKey]}
                                          onToggle={() => handleToggleMark(qIdKey)}
                                          label="Mark"
                                          isDarkMode={isDarkMode}
                                        />
                                        <button
                                          onClick={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: qObj.prompt, modelAnswer: qObj.modelAnswer || qObj.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 3 })}
                                          className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1"
                                        >
                                          <CheckCircle className="w-3.5 h-3.5" />
                                          <span>Check response</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Inline Evaluation Card for Part 3 */}
                                    <InlineEvaluationCard
                                      evaluation={itemEvaluations[qIdKey] || itemEvaluations[qObj.id]}
                                      userAnswerText={val}
                                      onRecheck={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: qObj.prompt, modelAnswer: qObj.modelAnswer || qObj.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 3 })}
                                      isDarkMode={isDarkMode}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Bottom Club Actions */}
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleSaveDraftLocal(currentQ.clubName)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                              style={{
                                backgroundColor: theme.btnSecondaryBg,
                                borderColor: theme.btnSecondaryBorder,
                                color: theme.btnSecondaryText
                              }}
                            >
                              Save draft
                            </button>

                            <button
                              onClick={() => handleClubSubmitLocal(currentQ.groupKey)}
                              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit this club →</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ================= PART 4: EMAIL WRITING (writing-p4.png) ================= */}
              {selectedPart === 4 && (
                <div className="space-y-12">
                  {displayClubs.map((clubObj, cIdx) => {
                    const currentQ = clubObj;
                    return (
                      <div key={currentQ.id || currentQ.groupKey || cIdx} id={`writing-club-${cIdx}`} data-scroll-index={cIdx} className="space-y-6 scroll-mt-24">
                        {/* Topic Header Banner rendered OUTSIDE white card matching Hình 1 */}
                        <TopicHeaderBanner
                          topicName={currentQ.clubName || currentQ.groupName || 'FITNESS & SPORTS CLUB'}
                          setInfo="2 emails (Informal & Formal)"
                          isDarkMode={isDarkMode}
                        />

                        <div
                          id={`writing-main-card-${cIdx}`}
                          className="p-6 rounded-2xl border space-y-6 shadow-xs"
                          style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                        >
                          {/* Scenario Callout Box */}
                          <div
                            className="p-4 rounded-xl border text-xs font-semibold leading-relaxed"
                            style={{
                              backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.6)' : '#eff6ff',
                              borderColor: isDarkMode ? '#334155' : '#bfdbfe',
                              color: isDarkMode ? '#cbd5e1' : '#1e3a8a'
                            }}
                          >
                            {currentQ.scenario}
                          </div>

                          {/* Task A: Informal Email */}
                          {(() => {
                            const infObj = currentQ.informalEmail;
                            const qIdKey = infObj?.questionId || `${currentQ.id}_p4_inf`;
                            const val = userAnswers[qIdKey] || userAnswers[`${currentQ.id}_p4_inf`] || '';
                            const wCount = countWords(val);
                            const minReq = infObj?.minWords || 40;
                            const maxReq = infObj?.maxWords || 50;
                            const isMet = wCount >= minReq && wCount <= maxReq;
                            const progressPct = Math.min(100, Math.round((wCount / maxReq) * 100));

                            return (
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-7 h-7 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 border"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe',
                                        borderColor: isDarkMode ? '#1d4ed8' : '#bfdbfe',
                                        color: isDarkMode ? '#93c5fd' : '#2563eb'
                                      }}
                                    >
                                      A
                                    </div>
                                    <h3 className="text-sm font-extrabold" style={{ color: theme.titleColor }}>
                                      Informal email to a friend
                                    </h3>
                                    <span
                                      className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff',
                                        borderColor: isDarkMode ? '#1d4ed8' : '#bfdbfe',
                                        color: isDarkMode ? '#93c5fd' : '#2563eb'
                                      }}
                                    >
                                      To: {infObj?.recipient || 'Alex (friend)'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff',
                                        borderColor: isDarkMode ? '#1d4ed8' : '#bfdbfe',
                                        color: isDarkMode ? '#93c5fd' : '#2563eb'
                                      }}
                                    >
                                      Required: {minReq}–{maxReq} words
                                    </span>
                                    <BookmarkButton
                                      isBookmarked={!!markedQuestions[qIdKey]}
                                      onToggle={() => handleToggleMark(qIdKey)}
                                      label="Mark"
                                      isDarkMode={isDarkMode}
                                    />
                                    <button
                                      onClick={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: infObj?.prompt, modelAnswer: infObj?.modelAnswer || infObj?.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 4 })}
                                      className="px-3 py-1 rounded-lg text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Check Task A</span>
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold" style={{ color: theme.subText }}>
                                  {infObj?.prompt || currentQ.taskInformal}
                                </p>

                                <div className="space-y-2">
                                  <textarea
                                    rows={4}
                                    value={val}
                                    onChange={(e) => handleTextChange(qIdKey, null, e.target.value)}
                                    placeholder="Hi Alex, ..."
                                    className="w-full p-4 rounded-xl text-xs font-medium border outline-none transition-all focus:border-blue-500 leading-relaxed"
                                    style={{
                                      backgroundColor: theme.inputBg,
                                      borderColor: theme.inputBorder,
                                      color: theme.inputText
                                    }}
                                  />

                                  <div className="flex items-center justify-between text-xs pt-1">
                                    <span
                                      className="font-extrabold"
                                      style={{ color: isMet ? '#16a34a' : '#2563eb' }}
                                    >
                                      {wCount} / {maxReq} words
                                    </span>
                                    <div
                                      className="w-48 h-2.5 rounded-full overflow-hidden"
                                      style={{ backgroundColor: theme.trackBg }}
                                    >
                                      <div
                                        className={`h-full transition-all duration-300 ${isMet ? 'bg-[#22c55e]' : 'bg-[#2563eb]'}`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Inline Evaluation Card for Part 4 Task A */}
                                <InlineEvaluationCard
                                  evaluation={itemEvaluations[qIdKey] || itemEvaluations[infObj?.questionId]}
                                  userAnswerText={val}
                                  onRecheck={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: infObj?.prompt, modelAnswer: infObj?.modelAnswer || infObj?.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 4 })}
                                  isDarkMode={isDarkMode}
                                />
                              </div>
                            );
                          })()}

                          {/* Task B: Formal Email */}
                          {(() => {
                            const formObj = currentQ.formalEmail;
                            const qIdKey = formObj?.questionId || `${currentQ.id}_p4_form`;
                            const val = userAnswers[qIdKey] || userAnswers[`${currentQ.id}_p4_form`] || '';
                            const wCount = countWords(val);
                            const minReq = formObj?.minWords || 120;
                            const maxReq = formObj?.maxWords || 150;
                            const isMet = wCount >= minReq && wCount <= maxReq;
                            const progressPct = Math.min(100, Math.round((wCount / maxReq) * 100));

                            return (
                              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-7 h-7 rounded-full font-extrabold text-xs flex items-center justify-center shrink-0 border"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe',
                                        borderColor: isDarkMode ? '#1d4ed8' : '#bfdbfe',
                                        color: isDarkMode ? '#93c5fd' : '#2563eb'
                                      }}
                                    >
                                      B
                                    </div>
                                    <h3 className="text-sm font-extrabold" style={{ color: theme.titleColor }}>
                                      Formal email to the club organiser
                                    </h3>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff',
                                        borderColor: isDarkMode ? '#1d4ed8' : '#bfdbfe',
                                        color: isDarkMode ? '#93c5fd' : '#2563eb'
                                      }}
                                    >
                                      Required: {minReq}–{maxReq} words
                                    </span>
                                    <BookmarkButton
                                      isBookmarked={!!markedQuestions[qIdKey]}
                                      onToggle={() => handleToggleMark(qIdKey)}
                                      label="Mark"
                                      isDarkMode={isDarkMode}
                                    />
                                    <button
                                      onClick={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: formObj?.prompt, modelAnswer: formObj?.modelAnswer || formObj?.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 4 })}
                                      className="px-3 py-1 rounded-lg text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      <span>Check Task B</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Fields Header: To & Subject */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold" style={{ color: theme.titleColor }}>To:</span>
                                    <input
                                      type="text"
                                      readOnly
                                      value={formObj?.toEmail || currentQ.toEmail || "club@greenfuture.org"}
                                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                                        color: isDarkMode ? '#f8fafc' : '#0f172a'
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="font-extrabold" style={{ color: theme.titleColor }}>Subject:</span>
                                    <input
                                      type="text"
                                      readOnly
                                      value={formObj?.subject || currentQ.subject || "Notice response & feedback"}
                                      className="flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none"
                                      style={{
                                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                                        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                                        color: isDarkMode ? '#f8fafc' : '#0f172a'
                                      }}
                                    />
                                  </div>
                                </div>

                                <p className="text-xs font-semibold" style={{ color: theme.subText }}>
                                  {formObj?.prompt || currentQ.taskFormal}
                                </p>

                                <div className="space-y-2">
                                  <textarea
                                    rows={6}
                                    value={val}
                                    onChange={(e) => handleTextChange(qIdKey, null, e.target.value)}
                                    placeholder="Dear Sir or Madam, ..."
                                    className="w-full p-4 rounded-xl text-xs font-medium border outline-none transition-all focus:border-blue-500 leading-relaxed"
                                    style={{
                                      backgroundColor: theme.inputBg,
                                      borderColor: theme.inputBorder,
                                      color: theme.inputText
                                    }}
                                  />

                                  <div className="flex items-center justify-between text-xs pt-1">
                                    <span
                                      className="font-extrabold"
                                      style={{ color: isMet ? '#16a34a' : '#2563eb' }}
                                    >
                                      {wCount} / {maxReq} words
                                    </span>
                                    <div
                                      className="w-48 h-2.5 rounded-full overflow-hidden"
                                      style={{ backgroundColor: theme.trackBg }}
                                    >
                                      <div
                                        className={`h-full transition-all duration-300 ${isMet ? 'bg-[#22c55e]' : 'bg-[#2563eb]'}`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Inline Evaluation Card for Part 4 Task B */}
                                <InlineEvaluationCard
                                  evaluation={itemEvaluations[qIdKey] || itemEvaluations[formObj?.questionId]}
                                  userAnswerText={val}
                                  onRecheck={() => handleClubSubmitLocal(currentQ.groupKey, qIdKey, val, { prompt: formObj?.prompt, modelAnswer: formObj?.modelAnswer || formObj?.sampleAnswer, minWords: minReq, maxWords: maxReq, partNumber: 4 })}
                                  isDarkMode={isDarkMode}
                                />
                              </div>
                            );
                          })()}

                          {/* Bottom Actions Bar */}
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleSaveDraftLocal(currentQ.clubName)}
                              className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                              style={{
                                backgroundColor: theme.btnSecondaryBg,
                                borderColor: theme.btnSecondaryBorder,
                                color: theme.btnSecondaryText
                              }}
                            >
                              Save draft
                            </button>

                            <button
                              onClick={() => handleClubSubmitLocal(currentQ.groupKey)}
                              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit this club →</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Group Navigation Bar (< and >) when in topic mode */}
              {currentMode === 'byClub' && groups && groups.length > 0 && (
                <div className="flex items-center justify-between pt-4 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      const currentIdx = groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam));
                      if (currentIdx > 0 && groups[currentIdx - 1]) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('mode', 'club');
                        newParams.set('group', groups[currentIdx - 1].group_key);
                        newParams.set('index', '1');
                        setSearchParams(newParams);
                      }
                    }}
                    disabled={groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam)) <= 0}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam)) > 0
                        ? isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-xs'
                        : 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <span className="text-xs font-extrabold" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                    {activeGroup?.name || 'Club'} ({Math.max(1, groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam)) + 1)} / {groups.length})
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const currentIdx = groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam));
                      if (currentIdx >= 0 && currentIdx < groups.length - 1 && groups[currentIdx + 1]) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('mode', 'club');
                        newParams.set('group', groups[currentIdx + 1].group_key);
                        newParams.set('index', '1');
                        setSearchParams(newParams);
                      }
                    }}
                    disabled={groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam)) >= groups.length - 1}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${groups.findIndex(g => g.group_key === (activeGroup?.group_key || groupParam)) < groups.length - 1
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

            {/* Right Column: Right Sidebar Navigator matching Reading & Listening */}
            <aside className="w-full lg:w-80 shrink-0 space-y-3 lg:sticky lg:top-20">

              {/* Top Timer & Progress Widget */}
              <ReadingTimerProgressWidget
                timeStr="00:00:00"
                answeredCount={answeredCount}
                totalCount={partQuestions.length}
                isDarkMode={isDarkMode}
              />

              {/* Navigator Main Card */}
              <div
                className="p-4 sm:p-5 rounded-2xl border transition-all flex flex-col max-h-[calc(100vh-10rem)] shadow-xs space-y-4 overflow-hidden"
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder
                }}
              >
                {/* Title: Part {selectedPart} */}
                <h3 className="text-base font-extrabold tracking-tight" style={{ color: theme.titleColor }}>
                  Part {selectedPart}
                </h3>

                {/* Jump input */}
                <form onSubmit={handleJump} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 1"
                      value={jumpInput}
                      onChange={(e) => setJumpInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border outline-none transition-all focus:border-blue-500"
                      style={{
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.inputText
                      }}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs transition-all flex items-center gap-1 shrink-0"
                    >
                      <Search className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Go</span>
                    </button>
                  </div>
                </form>

                {/* Status Legend */}
                <div
                  className="flex items-center justify-between text-xs font-semibold pt-2 pb-2 border-y"
                  style={{
                    borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                    color: theme.subText
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded border"
                      style={{
                        borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff'
                      }}
                    />
                    <span>Not answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-[#2563eb]" />
                    <span>Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded border border-rose-500 bg-rose-500/20" />
                    <Flag className="w-3 h-3 text-rose-500" aria-hidden="true" />
                    <span>Flagged</span>
                  </div>
                </div>

                {/* Question / Club List Items */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {partQuestions.map((qObj, idx) => {
                    const isActive = idx === currentIndex;
                    const qId = qObj.groupKey || qObj.id || idx;
                    const isSubmitted = !!submittedClubs[qObj.groupKey || qObj.clubName || qId];
                    const isFlagged = !!markedQuestions[qId];

                    return (
                      <button
                        key={qId}
                        onClick={() => handleSelectIndex(idx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${isActive
                          ? isDarkMode
                            ? 'bg-blue-950/50 border-blue-700 text-blue-300'
                            : 'bg-blue-50 border-blue-200 text-[#2563eb]'
                          : isDarkMode
                            ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        {/* Number badge */}
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${isSubmitted
                            ? 'bg-[#2563eb] text-white'
                            : isFlagged
                              ? 'bg-rose-500/20 text-rose-600 border border-rose-500'
                              : isActive
                                ? 'bg-[#2563eb] text-white'
                                : isDarkMode
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {idx + 1}
                        </span>

                        <span className="truncate flex-1 font-bold">
                          {qObj.clubName || qObj.groupName || `Exercise ${idx + 1}`}
                        </span>

                        {isFlagged && <Flag className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        {isSubmitted && !isFlagged && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Refactored Reusable NavigatorActionButtons Component */}
                <NavigatorActionButtons
                  flaggedCount={flaggedCount}
                  onToggleFilterBookmarked={handleReviewFlagged}
                  onSubmitAll={() => !submitted && setShowSubmitModal(true)}
                  isDarkMode={isDarkMode}
                />
              </div>

            </aside>

          </div>
        )}

        {/* Submit Confirmation Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className="p-6 rounded-2xl max-w-md w-full shadow-2xl border space-y-4"
              style={{
                backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                borderColor: isDarkMode ? '#29364a' : '#d8e2ef',
                color: isDarkMode ? '#ffffff' : '#0f172a'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl shrink-0">
                  <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Submit Writing Test?
                  </h3>
                  <p className="text-xs" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                    Part {selectedPart} submission confirmation (Edge Function boundary)
                  </p>
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 font-medium">
                  {submitError}
                </p>
              )}

              <p className="text-xs" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                Are you sure you want to submit your Part {selectedPart} Writing responses for secure evaluation?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  disabled={submitting}
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Continue Practicing
                </button>
                <button
                  disabled={submitting}
                  onClick={onModalSubmit}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Yes, Submit Now</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Evaluation Results Modal */}
        <AIEvaluationModal
          evaluation={activeEvaluation}
          onClose={() => setActiveEvaluation(null)}
          isDarkMode={isDarkMode}
        />

      </div>
    </div>
  );
};

export default WritingPractice;

