import { useState, useEffect, useCallback, useRef } from 'react';
import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';
import { getQuestions, getGroups } from '../services/aptisService.js';
import {
  createAttempt,
  getUserAttempts,
  getAttemptDetails,
  saveResponse,
  toggleBookmark as toggleBookmarkApi,
  normalizePracticeScope,
  findMatchingAttempt
} from '../services/practiceService.js';
import { submitAttempt } from '../services/submissionBoundary.js';
import { submitQuestion } from '../services/submissionService.js';
import { normalizeObjectiveResult } from '../services/evaluationApiClient.js';
import {
  adaptListeningPart1Data,
  adaptListeningPart2Data,
  adaptListeningPart3Data,
  adaptListeningPart4Data
} from '../adapters/listeningAdapter.js';

/**
 * Custom React Hook for Listening Practice (Phase 6B2 / Phase 2B2)
 */
export function useListeningPractice({
  activePart = 1,
  practiceMode = 'full',
  groupKeyParam = null
}) {
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
  const [adaptedData, setAdaptedData] = useState([]);

  // User interactions & Server Checking State Machine
  const [userAnswers, setUserAnswers] = useState({});
  const [markedQuestions, setMarkedQuestions] = useState({});
  const [submittedQuestions, setSubmittedQuestions] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState({});
  const [checkingQuestions, setCheckingQuestions] = useState({});
  const [checkErrors, setCheckErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const saveTimeoutRef = useRef(null);

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
              setAdaptedData([]);
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

        const targetGroupType = practiceMode === 'topic' ? 'topic' : 'practice_set';
        const fetchedGroups = await getGroups('listening', activePart, targetGroupType, client).catch(() => []);

        if (isCancelled) return;
        setGroups(fetchedGroups);

        let selectedGroup = null;
        if (groupKeyParam) {
          selectedGroup = fetchedGroups.find(g => g.group_key === groupKeyParam) || null;
        } else if (fetchedGroups.length > 0 && practiceMode !== 'full') {
          selectedGroup = fetchedGroups[0];
        }
        setActiveGroup(selectedGroup);

        const qFilters = {
          skill: 'listening',
          partNumber: activePart,
          groupKey: null
        };

        const res = await getQuestions(qFilters, 1, 500, client);
        if (isCancelled) return;

        const qList = res.data || [];
        setRawQuestions(qList);

        if (qList.length === 0) {
          setIsEmpty(true);
          setAdaptedData([]);
          setLoading(false);
          return;
        }

        const targetGroupParam = practiceMode === 'topic' ? selectedGroup : fetchedGroups;

        let adapted = [];
        if (activePart === 1) {
          adapted = adaptListeningPart1Data(qList, targetGroupParam);
        } else if (activePart === 2) {
          adapted = adaptListeningPart2Data(qList, targetGroupParam);
        } else if (activePart === 3) {
          adapted = adaptListeningPart3Data(qList, targetGroupParam);
        } else if (activePart === 4) {
          adapted = adaptListeningPart4Data(qList, targetGroupParam);
        }

        setAdaptedData(adapted);
        setLoading(false);
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load Listening data from Supabase.');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, authUser?.id, activePart, groupKeyParam, practiceMode]);

  // 3. Draft Persistence & Restoration
  const draftStorageKey = `aptis:draft:listening:part-${activePart}:${practiceMode}:${groupKeyParam || 'default'}`;

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(draftStorageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          setUserAnswers(parsed.userAnswers || {});
          setMarkedQuestions(parsed.markedQuestions || {});
          setSubmittedQuestions(parsed.submittedQuestions || {});
        }
      } else {
        setUserAnswers({});
        setMarkedQuestions({});
        setSubmittedQuestions({});
      }
    } catch {
      setUserAnswers({});
      setMarkedQuestions({});
      setSubmittedQuestions({});
    }
    setSubmitted(false);
    setResults({});
    setSubmitError(null);
  }, [draftStorageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({ userAnswers, markedQuestions, submittedQuestions })
      );
    } catch {}
  }, [draftStorageKey, userAnswers, markedQuestions, submittedQuestions]);

  // 4. Initialize / Resume Practice Attempt
  useEffect(() => {
    let isCancelled = false;

    async function initAttempt() {
      if (authStatus !== 'authenticated' || !authUser || loading || rawQuestions.length === 0) return;

      const isTopicOrSetMode = (practiceMode === 'topic' || practiceMode === 'practice_set' || practiceMode === 'by_topic');
      const targetGroupId = isTopicOrSetMode ? (activeGroup ? activeGroup.id : null) : null;

      if (isTopicOrSetMode && !targetGroupId) return;

      const scope = normalizePracticeScope({
        skill: 'listening',
        mode: practiceMode,
        partNumber: activePart,
        groupId: targetGroupId
      });

      setAttemptLoading(true);

      try {
        const client = getBrowserSupabaseClient();
        const existingAttempts = await getUserAttempts(authUser.id, client).catch(() => []);
        const matching = findMatchingAttempt(existingAttempts, scope);

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
            'listening',
            practiceMode,
            activePart,
            targetGroupId,
            client
          );
          if (!isCancelled) {
            setAttempt(newAtt);
          }
        }
      } catch (err) {
      } finally {
        if (!isCancelled) setAttemptLoading(false);
      }
    }

    initAttempt();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, authUser?.id, loading, activePart, practiceMode, activeGroup, rawQuestions.length]);

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
  const handleOptionSelect = useCallback((key, val) => {
    setUserAnswers(prev => {
      const next = { ...prev, [key]: val };
      triggerAutosave(key, val);
      return next;
    });
  }, [triggerAutosave]);

  const handleToggleMark = useCallback(async (key) => {
    setMarkedQuestions(prev => ({ ...prev, [key]: !prev[key] }));
    if (authUser && typeof key === 'string' && key.startsWith('q-')) {
      try {
        const client = getBrowserSupabaseClient();
        await toggleBookmarkApi(authUser.id, key, client);
      } catch (err) {}
    }
  }, [authUser]);

  const handleSubmitSingle = useCallback((itemId) => {
    setSubmittedQuestions(prev => ({ ...prev, [itemId]: true }));
  }, []);

  // 7. Server Question Checker (Phase 2B2 & 2B2.1)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const handleCheckQuestion = useCallback(async (qId, responseVal) => {
    if (!attempt || !attempt.id) {
      setError('Active practice attempt is required for checking.');
      return;
    }

    if (!qId || typeof qId !== 'string' || !UUID_REGEX.test(qId.trim())) {
      const errKey = qId || 'invalid';
      setCheckErrors(prev => ({
        ...prev,
        [errKey]: 'Invalid question ID: Must be a valid UUID. Cannot submit source key or group ID.'
      }));
      if (qId) setCheckingQuestions(prev => ({ ...prev, [qId]: false }));
      return;
    }

    const valToSubmit = responseVal !== undefined ? responseVal : userAnswers[qId];
    if (valToSubmit === undefined || valToSubmit === null || valToSubmit === '') {
      return;
    }

    if (checkingQuestions[qId]) return;

    setCheckingQuestions(prev => ({ ...prev, [qId]: true }));
    setCheckErrors(prev => ({ ...prev, [qId]: null }));

    try {
      const client = getBrowserSupabaseClient();
      const normalizedDto = await submitQuestion(attempt.id, qId, valToSubmit, client);
      setResults(prev => ({ ...(prev || {}), [qId]: normalizedDto }));
    } catch (err) {
      setCheckErrors(prev => ({ ...prev, [qId]: err.message || 'Server check failed' }));
    } finally {
      setCheckingQuestions(prev => ({ ...prev, [qId]: false }));
    }
  }, [attempt, userAnswers, checkingQuestions]);

  // 8. Submission Handler
  const handleConfirmSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (attempt) {
        const client = getBrowserSupabaseClient();
        const res = await submitAttempt(attempt.id, client);
        setResults(prev => ({ ...(prev || {}), ...(res.evaluations || res.results || {}) }));
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
  };
}

