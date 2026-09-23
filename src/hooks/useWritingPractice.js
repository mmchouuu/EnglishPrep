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
import { submitQuestion, submitAttempt } from '../services/submissionBoundary.js';
import { getEvaluation, getAttemptEvaluationStatus, submitResponse } from '../services/evaluationApiClient.js';

import {
  adaptWritingPart1Data,
  adaptWritingPart2Data,
  adaptWritingPart3Data,
  adaptWritingPart4Data,
  countWords
} from '../adapters/writingAdapter.js';

/**
 * Custom React Hook for Writing Practice (Phase 6B3)
 * Enforces RLS Auth Status Isolation:
 * - authStatus: 'loading' | 'unauthenticated' | 'authenticated'
 * - Does NOT fetch Writing questions until authStatus === 'authenticated'
 * - Manages autosave, draft persistence, attempt restoration, and submission boundary
 */
export function useWritingPractice({
  activePart = 1,
  practiceMode = 'byPart',
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

  // User interactions
  const [userAnswers, setUserAnswers] = useState({});
  const [markedQuestions, setMarkedQuestions] = useState({});
  const [submittedClubs, setSubmittedClubs] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
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

        // Fetch groups (clubs) for writing
        const fetchedGroups = await getGroups('writing', activePart, 'club', client).catch(() => []);

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
          skill: 'writing',
          partNumber: activePart,
          groupKey: null
        };

        const res = await getQuestions(qFilters, 1, 2000, client);
        if (isCancelled) return;

        const qList = res.data || [];
        setRawQuestions(qList);

        if (qList.length === 0) {
          setIsEmpty(true);
          setAdaptedData([]);
          setLoading(false);
          return;
        }

        const targetGroupParam = practiceMode === 'byClub' ? selectedGroup : fetchedGroups;

        let adapted = [];
        if (activePart === 1) {
          adapted = adaptWritingPart1Data(qList, targetGroupParam);
        } else if (activePart === 2) {
          adapted = adaptWritingPart2Data(qList, targetGroupParam);
        } else if (activePart === 3) {
          adapted = adaptWritingPart3Data(qList, targetGroupParam);
        } else if (activePart === 4) {
          adapted = adaptWritingPart4Data(qList, targetGroupParam);
        }

        setAdaptedData(adapted);
        setLoading(false);
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load Writing data from Supabase.');
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, authUser?.id, activePart, groupKeyParam, practiceMode]);

  // 3. Draft Persistence & Restoration (sessionStorage)
  const draftStorageKey = `aptis:draft:writing:part-${activePart}:${practiceMode}:${groupKeyParam || 'default'}`;

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(draftStorageKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          if (parsed.userAnswers) setUserAnswers(prev => ({ ...parsed.userAnswers, ...prev }));
          if (parsed.markedQuestions) setMarkedQuestions(prev => ({ ...parsed.markedQuestions, ...prev }));
          if (parsed.submittedClubs) setSubmittedClubs(prev => ({ ...parsed.submittedClubs, ...prev }));
        }
      }
    } catch { }
  }, [draftStorageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          userAnswers,
          markedQuestions,
          submittedClubs,
          updatedAt: new Date().toISOString()
        })
      );
    } catch { }
  }, [draftStorageKey, userAnswers, markedQuestions, submittedClubs]);

  // 4. Initialize / Resume Practice Attempt ONLY WHEN authStatus === 'authenticated'
  useEffect(() => {
    let isCancelled = false;

    async function initAttempt() {
      if (authStatus !== 'authenticated' || !authUser || loading || rawQuestions.length === 0) return;

      const isClubMode = (practiceMode === 'byClub' || practiceMode === 'club' || practiceMode === 'by_club');
      const targetGroupId = isClubMode ? (activeGroup ? activeGroup.id : null) : null;

      // Mandatory DB contract rule: Club practice REQUIRES a valid groupId
      if (isClubMode && !targetGroupId) {
        return; // Wait until activeGroup is available
      }

      const scope = normalizePracticeScope({
        skill: 'writing',
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
              const resText = typeof r.response === 'string' ? r.response : (r.response?.text || r.response?.content || '');
              if (resText) {
                restoredAnswers[r.question_id] = resText;
              }
            });
            setUserAnswers(prev => ({ ...restoredAnswers, ...prev }));
          }
        } else {
          const newAtt = await createAttempt(
            authUser.id,
            'writing',
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
        // Non-blocking attempt initialization catch
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
  const triggerAutosave = useCallback((questionId, textVal) => {
    if (!attempt || attempt.status !== 'in_progress') return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const wCount = countWords(textVal);
    const responsePayload = {
      text: textVal,
      word_count: wCount
    };

    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const client = getBrowserSupabaseClient();
        await saveResponse(attempt.id, questionId, responsePayload, wCount, null, client);
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
      }
    }, 800);
  }, [attempt]);

  // 6. Interaction Handlers
  const handleTextChange = useCallback((qId, fieldKey, val) => {
    const itemKey = fieldKey ? `${qId}_${fieldKey}` : String(qId);
    setUserAnswers(prev => {
      const next = { ...prev, [itemKey]: val };
      if (qId && qId !== itemKey) {
        next[qId] = val;
      }
      triggerAutosave(qId, val);
      return next;
    });
  }, [triggerAutosave]);

  const handleToggleMark = useCallback(async (itemKey) => {
    setMarkedQuestions(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
    const isValidUuid = typeof itemKey === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemKey);
    if (authUser && isValidUuid) {
      try {
        const client = getBrowserSupabaseClient();
        await toggleBookmarkApi(authUser.id, itemKey, client);
      } catch { }
    }
  }, [authUser]);

  const [activeEvaluation, setActiveEvaluation] = useState(null);
  const [itemEvaluations, setItemEvaluations] = useState({});

  const handleClubSubmit = useCallback((clubKey) => {
    setSubmittedClubs(prev => ({ ...prev, [clubKey]: true }));
  }, []);

  const handleSubmitSingleQuestion = useCallback(async (questionId, responsePayload, qMeta = {}) => {
    const qKey = questionId || 'q1';
    setSubmitting(true);
    setSubmitError(null);

    const currentPart = Number(qMeta.partNumber || activePart || 1);

    const rawModelCandidate = qMeta.modelAnswer || qMeta.sampleAnswer || qMeta.correctAnswer || null;
    // Prevent prompt text from accidentally acting as model answer
    const rawModel = (rawModelCandidate && rawModelCandidate !== qMeta.prompt) ? rawModelCandidate : null;

    const initialEvalObj = {
      status: 'pending',
      question_id: qKey,
      solution: rawModel ? { model_answer: rawModel } : null
    };
    setItemEvaluations(prev => ({ ...prev, [qKey]: initialEvalObj }));

    const getSmartSampleAnswer = (promptText) => {
      const lowerP = (promptText || '').toLowerCase();

      // Part 1: Under 10 words (Target 1-5 words)
      if (currentPart === 1 || qMeta.maxWords <= 10) {
        if (lowerP.includes('enjoy') || lowerP.includes('drawing') || lowerP.includes('painting')) {
          return 'Yes, I enjoy drawing landscapes.'; // 5 words
        }
        if (lowerP.includes('kind of art') || lowerP.includes('like')) {
          return 'I like modern oil paintings.'; // 5 words
        }
        if (lowerP.includes('exhibition') || lowerP.includes('visit')) {
          return 'I visited one last month.'; // 5 words
        }
        if (lowerP.includes('artist') || lowerP.includes('favourite') || lowerP.includes('favorite')) {
          return 'My favourite artist is Van Gogh.'; // 6 words
        }
        if (rawModel && countWords(rawModel) <= 10) return rawModel;
        return 'I love drawing in my free time.'; // 7 words (<10 words)
      }

      // Part 2: 20-30 words
      if (currentPart === 2 || (qMeta.minWords >= 15 && qMeta.maxWords <= 35)) {
        if (rawModel && countWords(rawModel) >= 20 && countWords(rawModel) <= 35) return rawModel;
        if (lowerP.includes('painting') || lowerP.includes('photo') || lowerP.includes('art') || lowerP.includes('picture')) {
          return 'I admire Starry Night by Van Gogh because its vibrant colors, expressive brushwork, and emotional intensity create a truly unforgettable masterpiece.'; // 22 words
        }
        if (lowerP.includes('travel') || lowerP.includes('trip') || lowerP.includes('place') || lowerP.includes('city') || lowerP.includes('visit')) {
          return 'I love visiting coastal towns in summer because the beautiful ocean scenery, delicious fresh seafood, and relaxed atmosphere help me unwind completely.'; // 23 words
        }
        if (lowerP.includes('sport') || lowerP.includes('fitness') || lowerP.includes('exercise') || lowerP.includes('health')) {
          return 'I regularly play badminton every weekend with my colleagues because it helps improve my physical fitness, reduces daily stress, and keeps me energized.'; // 23 words
        }
        return 'I joined this club to improve my English writing skills. I usually practice every weekend and look forward to sharing interesting ideas with everyone.'; // 24 words
      }

      // Part 3: 30-40 words
      if (currentPart === 3 || (qMeta.minWords >= 25 && qMeta.maxWords <= 45)) {
        if (rawModel && countWords(rawModel) >= 25 && countWords(rawModel) <= 45) return rawModel;
        if (lowerP.includes('instrument') || lowerP.includes('play') || lowerP.includes('learn')) {
          return 'I have been learning to play the piano for two years. Practice requires patience, but performing my favourite songs for my family gives me a great sense of satisfaction.'; // 30 words
        }
        if (lowerP.includes('concert') || lowerP.includes('event') || lowerP.includes('ticket') || lowerP.includes('live')) {
          return 'I attended a live outdoor concert last summer with my best friends. The atmosphere was incredible, and the band played all of our favourite songs under the starry sky.'; // 31 words
        }
        return 'I really enjoy listening to acoustic music after work. It helps me relax completely. I also play the guitar with my friends every weekend to have fun together.'; // 30 words
      }

      // Part 4 Task A: Informal email (40-50 words)
      if (currentPart === 4 && qMeta.maxWords <= 60) {
        if (rawModel && countWords(rawModel) >= 35 && countWords(rawModel) <= 55) return rawModel;
        return 'Hi Alex,\n\nI heard about the new club rules and I think it is a great idea. We should go together next Sunday afternoon to check out the new activities. Let me know if you are free!\n\nBest,\nChris'; // 42 words
      }

      // Part 4 Task B: Formal email (120-150 words)
      if (rawModel && countWords(rawModel) >= 110 && countWords(rawModel) <= 160) return rawModel;
      return 'Dear Sir or Madam,\n\nI am writing to express my thoughts regarding the recent changes announced in the club newsletter. Overall, I appreciate the committee\'s efforts to organize more diverse activities for all members.\n\nHowever, I would like to request clarification on the updated weekend schedule and membership fee policy. Many members, including myself, work full-time during weekdays and would prefer more flexible evening slots.\n\nThank you for considering my feedback. I look forward to hearing your response soon.\n\nYours faithfully,\nChris Chau'; // 132 words
    };

    const defaultMinW = currentPart === 1 ? 1 : currentPart === 2 ? 20 : currentPart === 3 ? 30 : (qMeta.maxWords && qMeta.maxWords > 100) ? 120 : 40;
    const defaultMaxW = currentPart === 1 ? 5 : currentPart === 2 ? 30 : currentPart === 3 ? 40 : (qMeta.maxWords && qMeta.maxWords > 100) ? 150 : 50;
    const minW = qMeta.minWords || defaultMinW;
    const maxW = qMeta.maxWords || defaultMaxW;

    const buildLocalFallbackEval = (resText) => {
      const wCount = countWords(resText);
      const trimmed = (resText || '').trim();
      let rawScore = 50;
      let cefr = 'A2';
      let fb = '';

      if (!trimmed) {
        rawScore = 0;
        cefr = 'A1';
        fb = 'Bạn chưa nhập câu trả lời. Hãy viết bài hoàn chỉnh để AI đánh giá nhé!';
      } else if (currentPart === 1 || maxW <= 10) {
        // Part 1: Target 1-5 words (max 10 words)
        if (wCount > 10) {
          rawScore = 50;
          cefr = 'A2';
          fb = `Part 1 yêu cầu câu trả lời ngắn gọn (1–5 từ). Bài làm (${wCount} từ) là quá dài cho Part 1.`;
        } else {
          rawScore = 75;
          cefr = 'B1';
          fb = `Bài làm Part 1 đáp ứng tốt dung lượng (${wCount} từ), trả lời đúng trọng tâm câu hỏi.`;
        }
      } else if (wCount < minW) {
        const diff = minW - wCount;
        rawScore = Math.max(30, 60 - diff * 4);
        cefr = rawScore < 45 ? 'A1' : 'A2';
        fb = `Bài làm quá ngắn (${wCount}/${minW} từ yêu cầu). Đề bài yêu cầu tối thiểu ${minW} từ, hãy mở rộng ý để đạt điểm cao hơn.`;
      } else if (wCount > maxW + 5) {
        const over = wCount - maxW;
        rawScore = Math.max(55, 75 - over * 3);
        cefr = 'B1';
        fb = `Bài làm dài hơn quy định (${wCount}/${maxW} từ). Hãy cô đọng lại đúng dung lượng yêu cầu để tránh bị trừ điểm Coherence.`;
      } else {
        // Evaluate lexical diversity & connectors
        const words = trimmed.toLowerCase().split(/\s+/);
        const uniqueWords = new Set(words);
        const diversityRatio = words.length > 0 ? uniqueWords.size / words.length : 0;
        
        const hasConnectors = /\b(because|although|however|since|and|but|so|because of|in order to|which|that|in addition|therefore|furthermore)\b/i.test(trimmed);
        const hasAdvancedVocab = words.some(w => w.length >= 7);
        const hasSalutation = currentPart === 4 && (/\b(dear|hi|hello|regards|sincerely|faithfully|best)\b/i.test(trimmed));
        
        let calculatedScore = 75; // Base score for fulfilling word count requirement
        if (diversityRatio > 0.75) calculatedScore += 5;
        if (hasConnectors) calculatedScore += 7;
        if (hasAdvancedVocab) calculatedScore += 5;
        if (hasSalutation) calculatedScore += 5;

        // Cap at part ceilings (Part 1: B1/75, Part 2: B2/85, Part 3: B2/88, Part 4: C1/95)
        const maxCap = currentPart === 1 ? 75 : currentPart === 2 ? 85 : currentPart === 3 ? 88 : 95;
        rawScore = Math.min(maxCap, calculatedScore);

        if (rawScore >= 90) {
          cefr = 'C1';
          fb = `Bài làm xuất sắc đạt chuẩn C1: Từ vựng phong phú, sử dụng từ nối tự nhiên và bố cục chuẩn mực (${wCount} từ).`;
        } else if (rawScore >= 80) {
          cefr = 'B2';
          fb = `Bài làm đạt chuẩn B2: Đáp ứng dung lượng (${wCount} từ), từ vựng phù hợp và có liên kết câu tốt.`;
        } else if (rawScore >= 65) {
          cefr = 'B1';
          fb = `Bài làm đạt mức B1 (${wCount} từ): Cấu trúc rõ ràng, trả lời đúng trọng tâm. Nên dùng thêm từ nối và tính từ gợi tả để nâng band.`;
        } else {
          cefr = 'A2';
          fb = `Bài làm cơ bản (${wCount} từ): Cần tăng tính liên kết giữa các vế câu và mở rộng vốn từ vựng chuyên sâu.`;
        }
      }

      return {
        id: `local_eval_${Date.now()}`,
        status: 'completed',
        question_id: qKey,
        normalized_score: rawScore,
        cefr_level: cefr,
        feedback: fb,
        solution: {
          model_answer: getSmartSampleAnswer(qMeta.prompt)
        },
        rubric_result: {
          spelling: { issues: [] }
        },
        updated_at: new Date().toISOString()
      };
    };

    try {
      if (attempt?.id) {
        const client = getBrowserSupabaseClient();
        const res = await submitResponse({
          attemptId: attempt.id,
          questionId: qKey,
          response: responsePayload
        }, client).catch(() => null);

        if (res) {
          setSubmittedClubs(prev => ({ ...prev, [qKey]: true }));
          const evalId = res?.evaluationId;
          const solutionData = res?.solution || { model_answer: getSmartSampleAnswer(qMeta.prompt) };

          if (evalId) {
            const pendingWithId = { id: evalId, status: 'pending', question_id: qKey, solution: solutionData };
            setItemEvaluations(prev => ({ ...prev, [qKey]: pendingWithId }));

            let pollCount = 0;
            const maxPolls = 15;
            const pollInterval = setInterval(async () => {
              pollCount++;
              try {
                const latest = await getEvaluation(evalId, client);
                if (latest) {
                  const fullEval = { ...latest, solution: solutionData || latest.rubric_result?.solution };
                  setItemEvaluations(prev => ({ ...prev, [qKey]: fullEval }));
                  if (['completed', 'failed', 'needs_review'].includes(latest.status)) {
                    clearInterval(pollInterval);
                  }
                }
                
                if (pollCount >= maxPolls) {
                  clearInterval(pollInterval);
                  setItemEvaluations(prev => {
                    const current = prev[qKey];
                    if (current && ['completed', 'failed', 'needs_review'].includes(current.status)) {
                      return prev;
                    }
                    return {
                      ...prev,
                      [qKey]: {
                        id: evalId,
                        status: 'failed',
                        error_code: 'TIMEOUT',
                        error_message: 'Thời gian chờ AI đánh giá quá lâu. Vui lòng bấm Chấm lại.',
                        question_id: qKey,
                        solution: solutionData
                      }
                    };
                  });
                }
              } catch {
                if (pollCount >= maxPolls) {
                  clearInterval(pollInterval);
                  setItemEvaluations(prev => ({
                    ...prev,
                    [qKey]: {
                      id: evalId,
                      status: 'failed',
                      error_code: 'POLL_ERROR',
                      error_message: 'Không thể kết nối đến máy chủ đánh giá. Vui lòng bấm Chấm lại.',
                      question_id: qKey,
                      solution: solutionData
                    }
                  }));
                }
              }
            }, 1500);
            return res;
          }
        }
      }

      // If attempt.id is missing or submission failed
      const errEval = {
        status: 'failed',
        error_code: 'SUBMISSION_FAILED',
        error_message: 'Gửi bài làm thất bại. Vui lòng thử lại.',
        question_id: qKey,
        solution: { model_answer: getSmartSampleAnswer(qMeta.prompt) }
      };
      setItemEvaluations(prev => ({ ...prev, [qKey]: errEval }));
      return errEval;

    } catch (err) {
      const errEval = {
        status: 'failed',
        error_code: 'SUBMISSION_ERROR',
        error_message: err.message || 'Lỗi gửi bài đánh giá.',
        question_id: qKey,
        solution: { model_answer: getSmartSampleAnswer(qMeta.prompt) }
      };
      setItemEvaluations(prev => ({ ...prev, [qKey]: errEval }));
      return errEval;
    } finally {
      setSubmitting(false);
    }
  }, [attempt?.id, activePart]);


  const handleConfirmSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (attempt) {
        const client = getBrowserSupabaseClient();
        const res = await submitAttempt(attempt.id, client);
        setResults(res.question_results || res.evaluations || res.results || {});

        // Start background polling for AI evaluation updates
        let pollCount = 0;
        const maxPolls = 20; // 60 seconds max
        const pollInterval = setInterval(async () => {
          pollCount++;
          try {
            const evals = await getAttemptEvaluationStatus(attempt.id, client);
            const isAllTerminal = evals.length > 0 && evals.every(e => ['completed', 'failed', 'needs_review'].includes(e.status));
            
            if (isAllTerminal || pollCount >= maxPolls) {
              clearInterval(pollInterval);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('aptis:evaluation-updated', { detail: { attemptId: attempt.id, evaluations: evals } }));
              }
            }
          } catch {
            if (pollCount >= maxPolls) clearInterval(pollInterval);
          }
        }, 3000);
      }
      setSubmitted(true);
      try {
        sessionStorage.removeItem(draftStorageKey);
      } catch { }
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [attempt, draftStorageKey]);



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
    submittedClubs,
    submitted,
    results,
    submitting,
    submitError,
    saveStatus,
    activeEvaluation,
    setActiveEvaluation,
    itemEvaluations,
    handleTextChange,
    handleToggleMark,
    handleClubSubmit,
    handleSubmitSingleQuestion,
    handleConfirmSubmit
  };
}


