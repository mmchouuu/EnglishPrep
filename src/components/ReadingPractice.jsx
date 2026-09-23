import React, { useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom';
import PartSelector from './reading/PartSelector';
import PracticeModeSelector from './reading/PracticeModeSelector';
import Part1QuestionNavigator from './reading/Part1QuestionNavigator';
import Part23ExerciseSetNavigator from './reading/Part23ExerciseSetNavigator';
import TopicSetNavigator from './reading/TopicSetNavigator';

import Part1SentenceComprehension from './reading/Part1SentenceComprehension';
import Part2TextCohesion from './reading/Part2TextCohesion';
import Part4OpinionMatching from './reading/Part4OpinionMatching';
import Part5LongTextComprehension from './reading/Part5LongTextComprehension';
import { AlertTriangle, RefreshCw, Database, Lock, LogIn, ShieldAlert } from 'lucide-react';
import { useReadingPractice } from '../hooks/useReadingPractice';

export function ReadingPractice({ isDarkMode = false }) {
  const { partId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Normalize partId slug ('part-1' -> '1', 'part-2-3' -> '2-3', 'part-4' -> '4', 'part-5' -> '5')
  const selectedPart = useMemo(() => {
    if (!partId) return '1';
    const clean = partId.toLowerCase().trim();
    if (
      clean === 'part-2-3' ||
      clean === '2-3' ||
      clean === 'part2-3' ||
      clean === 'part_2_3' ||
      clean === 'part-2' ||
      clean === 'part-3' ||
      clean === '2' ||
      clean === '3'
    ) {
      return '2-3';
    }
    if (clean === 'part-4' || clean === '4' || clean === 'part4' || clean === 'part_4') return '4';
    if (clean === 'part-5' || clean === '5' || clean === 'part5' || clean === 'part_5') return '5';
    return '1';
  }, [partId]);

  const practiceMode = searchParams.get('mode') || 'full';
  const groupParam = searchParams.get('group');
  const initialQuestionParam = searchParams.get('question');
  const initialQuestionIndex = initialQuestionParam ? Math.max(0, parseInt(initialQuestionParam, 10) - 1) : 0;

  const [currentIndex, setCurrentIndex] = useState(initialQuestionIndex);
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Real Database & Auth Hook for Phase 6B1
  const {
    authStatus,
    authUser,
    loading,
    error,
    isEmpty,
    groups,
    activeGroup,
    adaptedData,
    rawQuestions,
    userAnswers,
    bookmarks,
    submitted,
    results,
    checkingQuestions,
    checkErrors,
    submitting,
    submitError,
    saveStatus,
    handleSelectAnswer,
    handleUpdateOrdering,
    handleToggleBookmark,
    handleCheckQuestion,
    handleConfirmSubmit
  } = useReadingPractice({
    selectedPart,
    practiceMode,
    groupKeyParam: groupParam,
    initialQuestionIndex
  });

  const handleSelectGroup = (groupKey) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('group', groupKey);
    setSearchParams(newParams);
  };

  const isNavigatingRef = React.useRef(false);

  // Question selection handler for Part 1
  const handleSelectQuestion = (idx) => {
    isNavigatingRef.current = true;
    setCurrentIndex(idx);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('question', String(idx + 1));
    setSearchParams(newParams, { replace: true });
    setTimeout(() => { isNavigatingRef.current = false; }, 800);
  };

  // ScrollSpy: Update active question index on scroll
  React.useEffect(() => {
    if (loading || !adaptedData) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isNavigatingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idxAttr = entry.target.getAttribute('data-scroll-index');
            if (idxAttr !== null) {
              const idx = parseInt(idxAttr, 10);
              if (!isNaN(idx) && idx !== currentIndex) {
                setCurrentIndex(idx);
                const newParams = new URLSearchParams(window.location.search);
                newParams.set('question', String(idx + 1));
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
  }, [loading, adaptedData, currentIndex, setSearchParams]);

  // Switch Part route
  const handlePartSelect = (pId) => {
    const routeSlug = pId === '2-3' ? 'part-2-3' : `part-${pId}`;
    navigate(`/reading/${routeSlug}?mode=${practiceMode}`);
  };

  // Switch Mode query param
  const handleModeSelect = (modeVal) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('mode', modeVal);
    setSearchParams(newParams);
  };

  // Unanswered count calculation
  const unAnsweredCount = useMemo(() => {
    if (!adaptedData) return 0;
    if (selectedPart === '1') {
      const qList = adaptedData.questions || [];
      return qList.filter((q) => !userAnswers[q.id]).length;
    } else if (selectedPart === '2-3') {
      const setsList = adaptedData.sets || (adaptedData.set ? [adaptedData.set] : []);
      return setsList.filter((s) => !userAnswers[s.id]).length;
    } else if (selectedPart === '4' || selectedPart === '5') {
      const topicSets = adaptedData.topicSets || [];
      if (topicSets.length > 0) {
        let unanswered = 0;
        topicSets.forEach((ts) => {
          const items = ts.questions || ts.sections || [];
          items.forEach((item) => {
            if (!userAnswers[item.id]) unanswered++;
          });
        });
        return unanswered;
      }
      const qList = adaptedData.questions || adaptedData.sections || [];
      return qList.filter((q) => !userAnswers[q.id]).length;
    }
    return 0;
  }, [selectedPart, userAnswers, adaptedData]);

  const onModalSubmit = async () => {
    await handleConfirmSubmit();
    setShowSubmitModal(false);
  };

  // Build current return URL for login redirection
  const currentReturnUrl = encodeURIComponent(location.pathname + location.search);

  return (
    <div
      className="min-h-screen transition-colors"
      style={{
        backgroundColor: isDarkMode ? '#0b1220' : '#f7faff',
        color: isDarkMode ? '#f8fafc' : '#0f172a'
      }}
    >
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Header Label: Only READING PRACTICE + Auth/Save Status Indicator */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs font-extrabold text-[#2563eb] tracking-wider uppercase block">
              READING PRACTICE (SUPABASE LOCAL DATA)
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
              selectedPart={selectedPart}
              onSelectPart={handlePartSelect}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <PracticeModeSelector
              selectedPart={selectedPart}
              selectedMode={practiceMode}
              onSelectMode={handleModeSelect}
              hasTopics={String(selectedPart) !== '1'}
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
                Supabase Row Level Security (RLS) requires an authenticated user session to access Aptis Reading practice questions. Please sign in to continue.
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
            <p className="text-sm font-bold">Loading Reading Part {selectedPart} questions from Supabase Local...</p>
          </div>
        )}

        {/* State 4: Error State */}
        {authStatus === 'authenticated' && !loading && error && (
          <div className={`p-8 rounded-2xl border text-center space-y-4 ${
            isDarkMode ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-extrabold">Failed to load Reading data</h3>
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
            <p className="text-xs">No questions exist for Reading Part {selectedPart} in database.</p>
          </div>
        )}

        {/* State 6: Authenticated & Data Ready -> Render Workspace */}
        {authStatus === 'authenticated' && !loading && !error && !isEmpty && adaptedData && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 w-full">
              {selectedPart === '1' && (
                <Part1SentenceComprehension
                  questions={adaptedData.questions}
                  userAnswers={userAnswers}
                  bookmarks={bookmarks}
                  submitted={submitted}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onSelectOption={handleSelectAnswer}
                  onToggleBookmark={handleToggleBookmark}
                  onCheckQuestion={handleCheckQuestion}
                  isDarkMode={isDarkMode}
                />
              )}

              {selectedPart === '2-3' && (
                <Part2TextCohesion
                  set={adaptedData.set}
                  sets={adaptedData.sets}
                  userAnswers={userAnswers}
                  bookmarks={bookmarks}
                  submitted={submitted}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onUpdateOrdering={handleUpdateOrdering}
                  onToggleBookmark={handleToggleBookmark}
                  onCheckQuestion={handleCheckQuestion}
                  isDarkMode={isDarkMode}
                  mode={practiceMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={handleSelectGroup}
                />
              )}

              {selectedPart === '4' && (
                <Part4OpinionMatching
                  data={adaptedData}
                  userAnswers={userAnswers}
                  bookmarks={bookmarks}
                  submitted={submitted}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onSelectAnswer={handleSelectAnswer}
                  onToggleBookmark={handleToggleBookmark}
                  onCheckQuestion={handleCheckQuestion}
                  isDarkMode={isDarkMode}
                  mode={practiceMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={handleSelectGroup}
                />
              )}

              {selectedPart === '5' && (
                <Part5LongTextComprehension
                  data={adaptedData}
                  userAnswers={userAnswers}
                  bookmarks={bookmarks}
                  submitted={submitted}
                  results={results}
                  checkingQuestions={checkingQuestions}
                  checkErrors={checkErrors}
                  onSelectAnswer={handleSelectAnswer}
                  onToggleBookmark={handleToggleBookmark}
                  onCheckQuestion={handleCheckQuestion}
                  isDarkMode={isDarkMode}
                  mode={practiceMode}
                  groups={groups}
                  activeGroup={activeGroup}
                  onSelectGroup={handleSelectGroup}
                />
              )}
            </div>

            {/* Render DEDICATED Navigator per Part */}
            {selectedPart === '1' && (
              <Part1QuestionNavigator
                questions={adaptedData.questions || []}
                currentIndex={currentIndex}
                userAnswers={userAnswers}
                bookmarks={bookmarks}
                submitted={submitted}
                results={results}
                onSelectQuestion={handleSelectQuestion}
                onSubmitAll={() => !submitted && setShowSubmitModal(true)}
                filterBookmarked={filterBookmarked}
                onToggleFilterBookmarked={() => setFilterBookmarked(!filterBookmarked)}
                isDarkMode={isDarkMode}
              />
            )}

            {selectedPart === '2-3' && (
              <Part23ExerciseSetNavigator
                adaptedData={adaptedData}
                rawQuestions={rawQuestions}
                userAnswers={userAnswers}
                bookmarks={bookmarks}
                submitted={submitted}
                onSubmitAll={() => !submitted && setShowSubmitModal(true)}
                isDarkMode={isDarkMode}
              />
            )}

            {(selectedPart === '4' || selectedPart === '5') && (
              <TopicSetNavigator
                selectedPart={selectedPart}
                adaptedData={adaptedData}
                rawQuestions={rawQuestions}
                userAnswers={userAnswers}
                bookmarks={bookmarks}
                submitted={submitted}
                onSubmitAll={() => !submitted && setShowSubmitModal(true)}
                isDarkMode={isDarkMode}
              />
            )}
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
                    Submit Practice Test?
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

              {unAnsweredCount > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800 font-medium">
                  You have <strong>{unAnsweredCount} unanswered</strong> item(s). Are you sure you want to submit now?
                </p>
              ) : (
                <p className="text-xs" style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  You have completed all questions. Ready to submit and view your detailed feedback?
                </p>
              )}

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
}

export default ReadingPractice;
