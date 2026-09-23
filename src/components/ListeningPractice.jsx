import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import PartSelector from './reading/PartSelector';
import PracticeModeSelector from './reading/PracticeModeSelector';
import { ListeningNavigator } from './listening/ListeningNavigator';
import { Part1ShortConversations } from './listening/Part1ShortConversations';
import { Part2InformationMatching } from './listening/Part2InformationMatching';
import { Part3OpinionMatching } from './listening/Part3OpinionMatching';
import { Part4Monologues } from './listening/Part4Monologues';
import { AlertTriangle, RefreshCw, Database, ShieldAlert, LogIn } from 'lucide-react';
import { useListeningPractice } from '../hooks/useListeningPractice';
import confetti from 'canvas-confetti';

const listeningParts = [
  { id: '1', label: 'Part 1', sublabel: 'Short Conversations' },
  { id: '2', label: 'Part 2', sublabel: 'Information Matching' },
  { id: '3', label: 'Part 3', sublabel: 'Opinion Matching' },
  { id: '4', label: 'Part 4', sublabel: 'Longer Monologues' }
];

export const ListeningPractice = ({ isDarkMode = false }) => {
  const { partId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Validate part number (1, 2, 3, 4)
  const activePart = useMemo(() => {
    if (partId === 'part-2' || partId === '2') return 2;
    if (partId === 'part-3' || partId === '3') return 3;
    if (partId === 'part-4' || partId === '4') return 4;
    if (partId === 'part-1' || partId === '1') return 1;
    return null;
  }, [partId]);

  // Invalid route check -> redirect to /listening/part-1
  useEffect(() => {
    if (activePart === null) {
      navigate('/listening/part-1', { replace: true });
    }
  }, [activePart, navigate]);

  const currentMode = searchParams.get('mode') || 'full';
  const groupParam = searchParams.get('group');
  const paramQuestion = parseInt(searchParams.get('question') || '1', 10);
  const paramSet = parseInt(searchParams.get('set') || '1', 10);

  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Real Supabase Data & Auth Hook for Listening Phase 6B2
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
    submittedQuestions,
    submitted,
    results,
    checkingQuestions,
    checkErrors,
    submitting,
    submitError,
    saveStatus,
    handleOptionSelect,
    handleToggleMark,
    handleSubmitSingle,
    handleCheckQuestion,
    handleConfirmSubmit
  } = useListeningPractice({
    activePart: activePart || 1,
    practiceMode: currentMode,
    groupKeyParam: groupParam
  });

  // Indices derived from query params
  const currentIndex = useMemo(() => {
    if (activePart === 1 && Array.isArray(adaptedData)) {
      const idx = paramQuestion - 1;
      return Math.max(0, Math.min(idx, Math.max(0, adaptedData.length - 1)));
    }
    return 0;
  }, [paramQuestion, adaptedData, activePart]);

  const currentSetIndex = useMemo(() => {
    if ((activePart === 2 || activePart === 3) && Array.isArray(adaptedData)) {
      const idx = paramSet - 1;
      return Math.max(0, Math.min(idx, Math.max(0, adaptedData.length - 1)));
    }
    if (activePart === 4 && Array.isArray(adaptedData)) {
      const allSetsCount = adaptedData.flatMap(g => g.sets || []).length;
      const idx = paramSet - 1;
      return Math.max(0, Math.min(idx, Math.max(0, allSetsCount - 1)));
    }
    return 0;
  }, [paramSet, adaptedData, activePart]);

  const isNavigatingRef = React.useRef(false);

  // Navigation handlers that preserve query parameters
  const handleIndexChange = (newIdx) => {
    isNavigatingRef.current = true;
    const params = new URLSearchParams(searchParams);
    params.set('question', (newIdx + 1).toString());
    setSearchParams(params);
    setTimeout(() => { isNavigatingRef.current = false; }, 800);
  };

  const handleSetChange = (newSetIdx) => {
    isNavigatingRef.current = true;
    const params = new URLSearchParams(searchParams);
    params.set('set', (newSetIdx + 1).toString());
    setSearchParams(params);
    setTimeout(() => { isNavigatingRef.current = false; }, 800);
  };

  // ScrollSpy: Automatically sync question/set selection when user scrolls
  useEffect(() => {
    if (loading || !adaptedData) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isNavigatingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idxAttr = entry.target.getAttribute('data-scroll-index');
            if (idxAttr !== null) {
              const idx = parseInt(idxAttr, 10);
              if (!isNaN(idx)) {
                const params = new URLSearchParams(window.location.search);
                if (activePart === 1) {
                  if (idx !== currentIndex) {
                    params.set('question', (idx + 1).toString());
                    setSearchParams(params, { replace: true });
                  }
                } else {
                  if (idx !== currentSetIndex) {
                    params.set('set', (idx + 1).toString());
                    setSearchParams(params, { replace: true });
                  }
                }
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
  }, [loading, adaptedData, activePart, currentIndex, currentSetIndex, setSearchParams]);

  const handleSubmitItem = (itemId) => {
    handleSubmitSingle(itemId);
    confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
  };

  const onModalSubmit = async () => {
    await handleConfirmSubmit();
    setShowSubmitModal(false);
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.7 } });
  };

  const handleReviewFlagged = () => {
    const flaggedKeys = Object.keys(markedQuestions).filter(k => markedQuestions[k]);
    if (flaggedKeys.length === 0) {
      alert("Bạn chưa đánh dấu (mark) câu hỏi nào.");
    } else {
      alert(`Bạn có ${flaggedKeys.length} câu/set đã đánh dấu cần xem lại.`);
    }
  };

  // Build current return URL for login redirection
  const currentReturnUrl = encodeURIComponent(location.pathname + location.search);

  if (!activePart) return null;

  return (
    <div className={`min-h-screen pb-12 transition-colors ${
      isDarkMode ? 'bg-[#090d16] text-slate-100' : 'bg-[#f4f7fc] text-[#0f172a]'
    }`}>
      
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Label: LISTENING PRACTICE + Save Status Indicator */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs font-extrabold text-[#2563eb] tracking-wider uppercase block">
              LISTENING PRACTICE (SUPABASE DATA)
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            {authStatus === 'authenticated' && saveStatus === 'saving' && (
              <span className="text-amber-500 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
            {authStatus === 'authenticated' && saveStatus === 'saved' && (
              <span className="text-emerald-500 flex items-center gap-1">
                ✓ Saved to DB
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
              parts={listeningParts}
              selectedPart={String(activePart)}
              onSelectPart={(pId) => navigate(`/listening/part-${pId}?mode=${currentMode}`)}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <PracticeModeSelector
              selectedPart={String(activePart)}
              selectedMode={currentMode}
              onSelectMode={(mVal) => {
                const params = new URLSearchParams(searchParams);
                params.set('mode', mVal);
                setSearchParams(params);
              }}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* State 1: Auth Loading */}
        {authStatus === 'loading' && (
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin mx-auto" />
            <p className="text-sm font-bold">Verifying authentication session...</p>
          </div>
        )}

        {/* State 2: Unauthenticated User -> Auth Required State */}
        {authStatus === 'unauthenticated' && (
          <div className={`p-10 md:p-14 rounded-2xl border text-center space-y-5 shadow-lg ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-extrabold tracking-tight">Authentication Required</h3>
              <p className="text-xs leading-relaxed" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                Supabase Row Level Security (RLS) requires an authenticated user session to access Aptis Listening practice questions. Please sign in to continue.
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
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <RefreshCw className="w-8 h-8 text-[#2563eb] animate-spin mx-auto" />
            <p className="text-sm font-bold">Loading Listening Part {activePart} questions from Supabase...</p>
          </div>
        )}

        {/* State 4: Error State */}
        {authStatus === 'authenticated' && !loading && error && (
          <div className={`p-8 rounded-2xl border text-center space-y-4 ${
            isDarkMode ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-extrabold">Failed to load Listening data</h3>
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
        {authStatus === 'authenticated' && !loading && !error && isEmpty && (
          <div className={`p-12 rounded-2xl border text-center space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
          }`}>
            <Database className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-base font-extrabold">No questions found</h3>
            <p className="text-xs">No questions exist for Listening Part {activePart} in database.</p>
          </div>
        )}

        {/* State 6: Authenticated & Data Ready -> Render Workspace */}
        {authStatus === 'authenticated' && !loading && !error && !isEmpty && adaptedData && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Left Main Content */}
            <div className="flex-1 w-full space-y-6">
              
              {activePart === 1 && (
                <Part1ShortConversations
                  questions={adaptedData}
                  currentIndex={currentIndex}
                  onSelectIndex={handleIndexChange}
                  userAnswers={userAnswers}
                  onSelectOption={handleOptionSelect}
                  markedQuestions={markedQuestions}
                  onToggleMark={handleToggleMark}
                  submittedQuestions={submittedQuestions}
                  onSubmitSingle={handleSubmitItem}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onCheckQuestion={handleCheckQuestion}
                  mode={currentMode}
                  isDarkMode={isDarkMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={(gKey) => {
                    const params = new URLSearchParams(searchParams);
                    params.set('group', gKey);
                    setSearchParams(params);
                  }}
                />
              )}

              {activePart === 2 && (
                <Part2InformationMatching
                  sets={adaptedData}
                  currentSetIndex={currentSetIndex}
                  userAnswers={userAnswers}
                  onSelectOption={handleOptionSelect}
                  markedQuestions={markedQuestions}
                  onToggleMark={handleToggleMark}
                  submittedSets={submittedQuestions}
                  onSubmitSet={handleSubmitItem}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onCheckQuestion={handleCheckQuestion}
                  onSelectSet={handleSetChange}
                  mode={currentMode}
                  isDarkMode={isDarkMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={(gKey) => {
                    const params = new URLSearchParams(searchParams);
                    params.set('group', gKey);
                    params.set('set', '1');
                    setSearchParams(params);
                  }}
                />
              )}

              {activePart === 3 && (
                <Part3OpinionMatching
                  sets={adaptedData}
                  currentSetIndex={currentSetIndex}
                  userAnswers={userAnswers}
                  onSelectOption={handleOptionSelect}
                  markedQuestions={markedQuestions}
                  onToggleMark={handleToggleMark}
                  submittedSets={submittedQuestions}
                  onSubmitSet={handleSubmitItem}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onCheckQuestion={handleCheckQuestion}
                  onSelectSet={handleSetChange}
                  mode={currentMode}
                  isDarkMode={isDarkMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={(gKey) => {
                    const params = new URLSearchParams(searchParams);
                    params.set('group', gKey);
                    params.set('set', '1');
                    setSearchParams(params);
                  }}
                />
              )}

              {activePart === 4 && (
                <Part4Monologues
                  topicGroups={adaptedData}
                  currentSetIndex={currentSetIndex}
                  userAnswers={userAnswers}
                  onSelectOption={handleOptionSelect}
                  markedQuestions={markedQuestions}
                  onToggleMark={handleToggleMark}
                  submittedQuestions={submittedQuestions}
                  onSubmitSingle={handleSubmitItem}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onCheckQuestion={handleCheckQuestion}
                  onSelectSet={handleSetChange}
                  mode={currentMode}
                  isDarkMode={isDarkMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={(gKey) => {
                    const params = new URLSearchParams(searchParams);
                    params.set('group', gKey);
                    params.set('set', '1');
                    setSearchParams(params);
                  }}
                />
              )}

            </div>

            {/* Right Sidebar Navigator matching Reading UI */}
            <ListeningNavigator
              part={activePart}
              data={adaptedData}
              groups={groups}
              activeGroup={activeGroup}
              onSelectGroup={(gKey) => {
                const params = new URLSearchParams(searchParams);
                params.set('group', gKey);
                setSearchParams(params);
              }}
              currentIndex={currentIndex}
              currentSetIndex={currentSetIndex}
              onSelectIndex={handleIndexChange}
              onSelectSet={handleSetChange}
              userAnswers={userAnswers}
              markedQuestions={markedQuestions}
              submittedQuestions={submittedQuestions}
              setSubmittedState={submittedQuestions}
              onReviewFlagged={handleReviewFlagged}
              onSubmitAll={() => !submitted && setShowSubmitModal(true)}
              mode={currentMode}
              isDarkMode={isDarkMode}
            />

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
                    Submit Listening Test?
                  </h3>
                  <p className="text-xs" style={{ color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                    Part {activePart} submission confirmation (Edge Function boundary)
                  </p>
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 font-medium">
                  {submitError}
                </p>
              )}

              <p className="text-xs" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                Are you sure you want to submit your Part {activePart} Listening responses for secure server evaluation?
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

      </div>

    </div>
  );
};
