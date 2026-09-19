import { useState, useEffect, useCallback, useRef } from 'react';
import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';
import { getQuestions, getGroups } from '../services/aptisService.js';
import { createAttempt, getUserAttempts, getAttemptDetails, saveResponse, toggleBookmark as toggleBookmarkApi } from '../services/practiceService.js';
import { submitAttempt } from '../services/submissionBoundary.js';
import {
  adaptPart1Data,
  adaptPart2Data,
  adaptPart4Data,
  adaptPart5Data
} from '../adapters/readingAdapter.js';

/**
 * Custom React Hook for Reading Practice (Phase 6B1)
 * Enforces Strict RLS Auth Status Isolation:
 * - authStatus: 'loading' | 'unauthenticated' | 'authenticated'
 * - Does NOT fetch Reading questions until authStatus === 'authenticated'
 * - Displays Auth Required state when unauthenticated (never misinterprets as empty DB)
 */
export function useReadingPractice({
  selectedPart = '1',
  practiceMode = 'full',
  groupKeyParam = null,
  initialQuestionIndex = 0
}) {
  const [dbPartNumber, setDbPartNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);

  // Auth Status State
  const [authStatus, setAuthStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [authUser, setAuthUser] = useState(null);

  const [attempt, setAttempt] = useState(null);
  const [attemptLoading, setAttemptLoading] = useState(false);

  // Data payloads
  const [rawQuestions, setRawQuestions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [adaptedData, setAdaptedData] = useState(null);

  // User interactions
  const [userAnswers, setUserAnswers] = useState({});
  const [bookmarks, setBookmarks] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const saveTimeoutRef = useRef(null);

  // Map UI part slug to DB part_number
  useEffect(() => {
    let pNum = 1;
    if (selectedPart === '2-3') pNum = 2;
    else if (selectedPart === '4') pNum = 4;
    else if (selectedPart === '5') pNum = 5;
    setDbPartNumber(pNum);
  }, [selectedPart]);

  // 1. Initialize Auth Session & Subscription
  useEffect(() => {
    let isCancelled = false;

    async function initAuth() {
      setAuthStatus('loading');
      try {
        const client = getBrowserSupabaseClient();
        if (!client) {
          if (!isCancelled) {
            setAuthStatus('unauthenticated');
            setAuthUser(null);
          }
          return;
        }

        const { data: { session } } = await client.auth.getSession();
        if (!isCancelled) {
          if (session?.user) {
            setAuthUser(session.user);
            setAuthStatus('authenticated');
          } else {
            setAuthUser(null);
            setAuthStatus('unauthenticated');
          }
        }

        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
          if (!isCancelled) {
            if (session?.user) {
              setAuthUser(session.user);
              setAuthStatus('authenticated');
            } else {
              setAuthUser(null);
              setAuthStatus('unauthenticated');
              setAttempt(null);
              setRawQuestions([]);
              setAdaptedData(null);
            }
          }
        });

        return () => subscription.unsubscribe();
      } catch (err) {
        if (!isCancelled) {
          setAuthStatus('unauthenticated');
          setAuthUser(null);
        }
      }
    }

    initAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Fetch Data ONLY WHEN authStatus === 'authenticated'
  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      // STRICT RULE: Do not query questions before auth completes or if unauthenticated
      if (authStatus !== 'authenticated' || !authUser) {
        setLoading(false);
        setIsEmpty(false);
        return;
      }

      setLoading(true);
      setError(null);
      setIsEmpty(false);

      try {
        const client = getBrowserSupabaseClient();
        if (!client) {
          throw new Error('Supabase client is not available. Please check configuration.');
        }

        // Fetch groups for part
        const fetchedGroups = await getGroups('reading', dbPartNumber, null, client).catch(() => []);
        
        if (isCancelled) return;
        setGroups(fetchedGroups);

        let selectedGroup = null;
        if (groupKeyParam) {
          selectedGroup = fetchedGroups.find(g => g.group_key === groupKeyParam) || null;
        } else if (fetchedGroups.length > 0) {
          selectedGroup = fetchedGroups[0];
        }
        setActiveGroup(selectedGroup);

        const qFilters = {
          skill: 'reading',
          partNumber: dbPartNumber,
          groupKey: null
        };

        const res = await getQuestions(qFilters, 1, 500, client);
        if (isCancelled) return;

        const qList = res.data || [];
        setRawQuestions(qList);

        if (qList.length === 0) {
          setIsEmpty(true);
          setAdaptedData(null);
          setLoading(false);
          return;
        }

        let adapted = null;
        if (dbPartNumber === 1) {
          adapted = adaptPart1Data(qList);
        } else if (dbPartNumber === 2) {
          adapted = adaptPart2Data(qList, selectedGroup);
        } else if (dbPartNumber === 4) {
          adapted = adaptPart4Data(qList, selectedGroup);
        } else if (dbPartNumber === 5) {
          adapted = adaptPart5Data(qList, selectedGroup);
        }

        setAdaptedData(adapted);
        setLoading(false);
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load Reading data from Supabase Local.');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, authUser?.id, dbPartNumber, groupKeyParam, practiceMode]);

  // 3. Draft Persistence & Restoration
  const draftStorageKey = `aptis:draft:reading:part-${selectedPart}:${practiceMode}:${groupKeyParam || 'default'}`;

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(draftStorageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          setUserAnswers(parsed.userAnswers || {});
          setBookmarks(parsed.bookmarks || {});
        }
      } else {
        setUserAnswers({});
        setBookmarks({});
      }
    } catch {
      setUserAnswers({});
      setBookmarks({});
    }
    setSubmitted(false);
    setResults(null);
    setSubmitError(null);
  }, [draftStorageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({ userAnswers, bookmarks })
      );
    } catch {}
  }, [draftStorageKey, userAnswers, bookmarks]);

  // 4. Initialize / Resume Practice Attempt ONLY WHEN authStatus === 'authenticated'
  useEffect(() => {
    let isCancelled = false;

    async function initAttempt() {
      if (authStatus !== 'authenticated' || !authUser || loading || rawQuestions.length === 0) return;
      setAttemptLoading(true);

      try {
        const client = getBrowserSupabaseClient();
        const existingAttempts = await getUserAttempts(authUser.id, client).catch(() => []);
        
        const matching = existingAttempts.find(
          a => a.skill === 'reading' &&
               a.status === 'in_progress' &&
               a.part_number === dbPartNumber &&
               a.practice_mode === practiceMode
        );

        if (isCancelled) return;

        if (matching) {
          setAttempt(matching);
          const { responses } = await getAttemptDetails(matching.id, authUser.id, client).catch(() => ({ responses: [] }));
          if (!isCancelled && responses && responses.length > 0) {
            const restoredAnswers = {};
            responses.forEach(r => {
              restoredAnswers[r.question_id] = r.response;
            });
            setUserAnswers(prev => ({ ...restoredAnswers, ...prev }));
          }
        } else {
          const newAtt = await createAttempt(
            authUser.id,
            'reading',
            practiceMode,
            dbPartNumber,
            activeGroup ? activeGroup.id : null,
            client
          );
          if (!isCancelled) {
            setAttempt(newAtt);
          }
        }
      } catch (err) {
        // Non-blocking attempt initialization catch
      } finally {
        if (!isCancelled) setAttemptLoading(false);
      }
    }

    initAttempt();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, authUser?.id, loading, dbPartNumber, practiceMode, activeGroup, rawQuestions.length]);

  // 5. Response Autosave to Database
  const triggerAutosave = useCallback((qId, responseVal) => {
    if (!attempt || attempt.status !== 'in_progress') return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const client = getBrowserSupabaseClient();
        await saveResponse(attempt.id, qId, responseVal, null, null, client);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
      }
    }, 600);
  }, [attempt]);

  // 6. Interaction Handlers
  const handleSelectAnswer = useCallback((qId, val) => {
    setUserAnswers(prev => {
      const next = { ...prev, [qId]: val };
      triggerAutosave(qId, val);
      return next;
    });
  }, [triggerAutosave]);

  const handleUpdateOrdering = useCallback((setId, newOrder) => {
    setUserAnswers(prev => {
      const next = { ...prev, [setId]: newOrder };
      triggerAutosave(setId, newOrder);
      return next;
    });
  }, [triggerAutosave]);

  const handleToggleBookmark = useCallback(async (qId) => {
    setBookmarks(prev => ({ ...prev, [qId]: !prev[qId] }));
    if (authUser) {
      try {
        const client = getBrowserSupabaseClient();
        await toggleBookmarkApi(authUser.id, qId, client);
      } catch (err) {}
    }
  }, [authUser]);

  // 7. Submission Handler
  const handleConfirmSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (attempt) {
        const client = getBrowserSupabaseClient();
        const res = await submitAttempt(attempt.id, client);
        setResults(res.question_results || res.evaluations || res.results || {});
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [attempt]);

  return {
    authStatus,
    authUser,
    loading,
    error,
    isEmpty,
    attempt,
    attemptLoading,
    groups,
    activeGroup,
    rawQuestions,
    adaptedData,
    userAnswers,
    bookmarks,
    submitted,
    results,
    submitting,
    submitError,
    saveStatus,
    handleSelectAnswer,
    handleUpdateOrdering,
    handleToggleBookmark,
    handleConfirmSubmit
  };
}
