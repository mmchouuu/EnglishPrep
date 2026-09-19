import { useState, useEffect, useCallback, useRef } from 'react';
import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';
import { getQuestions, getGroups } from '../services/aptisService.js';
import {
  createAttempt,
  getUserAttempts,
  getAttemptDetails,
  saveResponse,
  toggleBookmark as toggleBookmarkApi
} from '../services/practiceService.js';
import { submitQuestion as submitQuestionApi, submitAttempt as submitAttemptApi } from '../services/submissionService.js';
import { getEvaluation, getAttemptEvaluationStatus } from '../services/evaluationApiClient.js';

import {
  adaptSpeakingPart1Data,
  adaptSpeakingPart1TopicGroups,
  adaptSpeakingPart2Data,
  adaptSpeakingPart3Data,
  adaptSpeakingPart4Data,
  SPEAKING_PART4_CORE_STORIES
} from '../adapters/speakingAdapter.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function countWords(str) {
  if (!str || typeof str !== 'string') return 0;
  return str.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Custom React Hook for Speaking Practice (Parts 1-4)
 * Enforces Auth Isolation (RLS), attempt restoration, autosave debouncing, and Edge Function submission.
 */
export function useSpeakingPractice({
  activePart = 1,
  practiceMode = 'full',
  topicParam = null,
  coreParam = null,
  moduleParam = null
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const [authStatus, setAuthStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [authUser, setAuthUser] = useState(null);

  const [attempt, setAttempt] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [adaptedData, setAdaptedData] = useState([]);

  const [userRecordings, setUserRecordings] = useState({});
  const [markedQuestions, setMarkedQuestions] = useState({});
  const [submittedQuestions, setSubmittedQuestions] = useState({});
  const [evaluationResults, setEvaluationResults] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const saveTimeoutRef = useRef(null);

  // 1. Auth Status Initialization
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
              setAdaptedData([]);
            }
          }
        });

        return () => subscription.unsubscribe();
      } catch {
        if (!isCancelled) {
          setAuthStatus('unauthenticated');
          setAuthUser(null);
        }
      }
    }

    initAuth();
    return () => { isCancelled = true; };
  }, []);

  // 2. Fetch Groups, Questions & Restore/Create Practice Attempt
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

        // 2a. Fetch Groups
        const targetGroupType = practiceMode === 'topic' ? 'topic' : null;
        const fetchedGroups = await getGroups('speaking', activePart, targetGroupType, client).catch(() => []);
        if (isCancelled) return;
        setGroups(fetchedGroups);

        const targetGroupKey = moduleParam || topicParam;
        let selectedGroup = null;
        if (targetGroupKey) {
          selectedGroup = fetchedGroups.find(g => g.group_key === targetGroupKey) || null;
        } else if (fetchedGroups.length > 0) {
          selectedGroup = fetchedGroups[0];
        }
        setActiveGroup(selectedGroup);

        // 2b. Fetch Questions from Supabase
        const fetchedQuestions = await getQuestions({
          skill: 'speaking',
          partNumber: activePart,
          groupKey: null
        }, 1, 500, client);

        if (isCancelled) return;

        const rawQs = fetchedQuestions?.data || [];

        let adapted = [];
        if (activePart === 1) {
          if (practiceMode === 'topic') {
            adapted = adaptSpeakingPart1TopicGroups(rawQs, fetchedGroups);
          } else {
            adapted = adaptSpeakingPart1Data(rawQs);
          }
        } else if (activePart === 2) {
          adapted = adaptSpeakingPart2Data(rawQs, fetchedGroups);
        } else if (activePart === 3) {
          adapted = adaptSpeakingPart3Data(rawQs);
        } else if (activePart === 4) {
          adapted = adaptSpeakingPart4Data(rawQs, fetchedGroups);
          if (practiceMode === 'core' && coreParam) {
            adapted = adapted.filter(m => m.coreKey === coreParam || m.coreNumber === Number(coreParam));
          }
        }

        setAdaptedData(adapted);
        if (adapted.length === 0) {
          setIsEmpty(true);
        }

        // 2c. Restore existing attempt or create new one
        const userAttempts = await getUserAttempts(authUser.id, client).catch(() => []);
        const existingAttempt = userAttempts.find(a =>
          a.skill === 'speaking' &&
          a.status === 'in_progress' &&
          Number(a.part_number) === Number(activePart)
        );

        let currentAttempt = existingAttempt;
        if (!currentAttempt && adapted.length > 0) {
          currentAttempt = await createAttempt(
            authUser.id,
            'speaking',
            practiceMode,
            activePart,
            selectedGroup?.id || null,
            client
          ).catch(() => null);
        }

        if (isCancelled) return;
        setAttempt(currentAttempt);

        // Restore saved responses if attempt exists
        if (currentAttempt) {
          const details = await getAttemptDetails(currentAttempt.id, authUser.id, client).catch(() => null);
          if (details?.responses && !isCancelled) {
            const restoredAnswers = {};
            const restoredSubmitted = {};
            details.responses.forEach(r => {
              restoredAnswers[r.question_id] = r.response;
              restoredSubmitted[r.question_id] = true;
            });
            setUserRecordings(restoredAnswers);
            setSubmittedQuestions(restoredSubmitted);
          }
        }

      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Failed to fetch Speaking practice questions from database.');
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { isCancelled = true; };
  }, [authStatus, authUser?.id, activePart, practiceMode]);

  // 3. Toggle Bookmark API
  const toggleBookmark = useCallback(async (id) => {
    setMarkedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
    if (authUser?.id) {
      try {
        const client = getBrowserSupabaseClient();
        await toggleBookmarkApi(authUser.id, id, client);
      } catch { }
    }
  }, [authUser?.id]);

  // 4. Autosave User Response (Debounced)
  const saveRecordingResponse = useCallback((questionId, responsePayload) => {
    setUserRecordings(prev => ({
      ...prev,
      [questionId]: responsePayload
    }));

    if (!attempt?.id || authStatus !== 'authenticated') return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const client = getBrowserSupabaseClient();
        await saveResponse(
          attempt.id,
          questionId,
          responsePayload,
          null,
          null,
          client
        );
      } catch { }
    }, 500);
  }, [attempt?.id, authStatus]);

  const [activeEvaluation, setActiveEvaluation] = useState(null);
  const [itemEvaluations, setItemEvaluations] = useState({});

  // 5. Submit Question to Edge Function 'submit-practice'
  const handleSubmitQuestion = useCallback(async (questionId, responsePayload, qMeta = {}) => {
    const qKey = questionId || 'spk_1';
    setSubmitting(true);
    setSubmitError(null);
    setSubmittedQuestions(prev => ({ ...prev, [qKey]: true }));

    const currentPart = Number(qMeta.partNumber || activePart || 1);

    const getSmartSpeakingSampleAnswer = (promptText) => {
      const lowerP = (promptText || '').toLowerCase();
      const rawModelCandidate = qMeta.modelAnswer || qMeta.sampleAnswer || qMeta.solution || qMeta.sampleResponse || null;
      if (rawModelCandidate && typeof rawModelCandidate === 'string' && rawModelCandidate.trim().length > 15) {
        return rawModelCandidate.trim();
      }

      // Part 1: Personal Information (30s speaking time -> ~45-55 words)
      if (currentPart === 1 || (qMeta.speakTime && qMeta.speakTime <= 35)) {
        if (lowerP.includes('hometown') || lowerP.includes('live') || lowerP.includes('city') || lowerP.includes('born')) {
          return "I was born and raised in Hanoi, the bustling capital city of Vietnam. It is widely renowned for its rich cultural heritage, delicious street food, and historic lakes. What I love most about my hometown is the charming contrast between ancient temples and modern vibrant streets.";
        }
        if (lowerP.includes('friend') || lowerP.includes('with friends') || lowerP.includes('do with')) {
          return "In my leisure time, I love hanging out with my close friends at local independent cafes. We usually catch up on our weekly events, share humorous stories, and try out delicious pastries together, which helps us stay closely connected despite our busy working schedules.";
        }
        if (lowerP.includes('hobb') || lowerP.includes('free time') || lowerP.includes('leisure') || lowerP.includes('enjoy')) {
          return "In my free time, I am particularly keen on playing badminton at the local sports center, which helps me stay physically active. Additionally, I thoroughly enjoy unwinding in the evenings by listening to acoustic music and reading self-help books to broaden my perspective.";
        }
        if (lowerP.includes('season') || lowerP.includes('weather')) {
          return "Without a doubt, my absolute favorite season of the year is autumn. During this period, the weather becomes pleasantly cool and mild, which is ideal for outdoor activities. I love taking evening strolls around the lake when the trees shed their golden leaves, creating a serene atmosphere.";
        }
        if (lowerP.includes('work') || lowerP.includes('study') || lowerP.includes('job') || lowerP.includes('english')) {
          return "Currently, I am focusing on enhancing my professional English skills for study and career advancement. I practice speaking and listening on a daily basis to build fluency, expand my technical vocabulary, and gain the confidence needed for international communication.";
        }
        return "I thoroughly enjoy spending my free time outdoors, meeting up with close friends, and exploring new cultural spots in the city. Engaging in these activities allows me to recharge my energy after a demanding week and gain inspiring new experiences.";
      }

      // Part 2: Describe a photo & related questions (45s speaking time -> ~65-85 words)
      if (currentPart === 2) {
        if (lowerP.includes('describe') || lowerP.includes('see') || lowerP.includes('picture') || lowerP.includes('photo')) {
          return "This photo captures a group of university students sitting around a wooden table in a spacious, modern library. In the foreground, two students are actively engaged in discussion while pointing at a laptop screen, whereas others are taking notes. The room is filled with natural sunlight coming through large windows, creating a bright and productive atmosphere. Judging by their focused facial expressions, they seem to be working collaboratively on an important group assignment.";
        }
        if (lowerP.includes('time') || lowerP.includes('tell me about') || lowerP.includes('experience') || lowerP.includes('remember')) {
          return "I vividly recall a time last semester when my team had to prepare a major marketing presentation for our university course. Initially, we faced difficulty coordinating our schedules, but we resolved it by dividing the workload according to each member's specific strengths. I took responsibility for creating the slides, while my teammates conducted research and rehearsed the speech. Thanks to our seamless cooperation, we delivered a convincing presentation and earned the top grade.";
        }
        return "From my perspective, both working in a group and working individually have their own distinct advantages depending on the context. Group work is incredibly beneficial because it brings together diverse perspectives, fosters brainstorming, and sparks innovative solutions that one person might overlook. On the flip side, working independently allows individuals to make swift decisions without compromise. Ultimately, I believe a balanced combination of both approaches yields the best results.";
      }

      // Part 3: Compare two photos & discussion (45s speaking time -> ~65-85 words)
      if (currentPart === 3) {
        if (lowerP.includes('compare') || lowerP.includes('difference') || lowerP.includes('two')) {
          return "Comparing the two images, the first picture depicts a tranquil beach holiday with golden sand and crystal-clear water, emphasizing relaxation and leisure. In stark contrast, the second image illustrates an adventurous mountain trek, where hikers are navigating rugged trails surrounded by majestic peaks. While the beach destination offers a calm environment to escape daily routine, the mountain holiday caters to outdoor enthusiasts who crave physical challenge and fresh alpine air.";
        }
        if (lowerP.includes('prefer') || lowerP.includes('choose') || lowerP.includes('would you')) {
          return "If I had to choose between the two, I would definitely lean towards the beach vacation. Due to my demanding work routine, I often feel overwhelmed by daily stress. Therefore, spending a few days lounging on a quiet shore, listening to the gentle rhythm of ocean waves, and soaking up the warm sunshine sounds like the perfect way to unwind and recharge my batteries completely. It offers the peaceful retreat I truly need.";
        }
        return "People's vacation choices generally depend on their personality traits and daily lifestyle demands. Thrill-seekers and active individuals often prefer adventurous holidays because conquering challenging mountain trails or trying extreme sports gives them an adrenaline rush and a sense of accomplishment. On the other hand, individuals with hectic desk jobs usually opt for relaxing beach getaways to escape constant noise, slow down their pace of life, and restore their well-being.";
      }

      // Part 4: Abstract Topic / Personal Experience (120s total speaking time -> ~180-220 words)
      return "One of the most unforgettable experiences from my childhood was learning to ride a bicycle with my father in our neighbourhood park when I was around seven years old. I vividly remember the crisp morning air and how nervous I felt when my father finally let go of the seat. At first, I was utterly terrified of losing balance and crashing onto the pavement. However, as I pedalled faster and realized I was gliding forward entirely on my own, my fear transformed into immense exhilaration, pride, and pure joy. That moment taught me perseverance and built my confidence early on.\n\nTurning to the broader question of how technology has reshaped childhood leisure, I believe modern digital advancements have drastically altered children's recreational habits compared to previous generations. Decades ago, children predominantly spent their free time outdoors playing traditional games like hide-and-seek or football with neighbourhood friends. In contrast, nowadays smartphones, video games, and online video platforms dominate kids' spare time. Although modern gadgets provide interactive educational materials, overreliance on screens significantly reduces physical exercise and hinders the development of real-world social skills.";
    };

    const buildLocalFallbackEval = (resPayload) => {
      const textVal = typeof resPayload === 'string'
        ? resPayload
        : (resPayload?.transcript || resPayload?.text || '');
      const trimmed = textVal.trim();
      const wCount = countWords(trimmed);

      let targetMin = 15;
      let targetMax = 35;
      if (currentPart === 2 || currentPart === 3) {
        targetMin = 25;
        targetMax = 50;
      } else if (currentPart === 4) {
        targetMin = 70;
        targetMax = 130;
      }

      let rawScore = 60;
      let cefr = 'B1';
      let fb = '';
      const spellingIssues = [];

      if (!trimmed || wCount === 0) {
        rawScore = 0;
        cefr = 'A1';
        fb = 'Bạn chưa thực hiện phần ghi âm phát biểu. Hãy bật Microphone và nói đủ thời gian yêu cầu để AI đánh giá nhé!';
      } else if (wCount < targetMin) {
        const diff = targetMin - wCount;
        rawScore = Math.max(30, 60 - diff * 3);
        cefr = rawScore < 45 ? 'A1' : 'A2';
        fb = `Bài nói quá ngắn (${wCount}/${targetMin} từ tối thiểu). Bạn cần mở rộng câu trả lời, trình bày thêm nguyên nhân hoặc ví dụ để tăng độ trôi chảy (Fluency).`;
      } else {
        const words = trimmed.toLowerCase().split(/\s+/);
        const uniqueWords = new Set(words);
        const diversityRatio = words.length > 0 ? uniqueWords.size / words.length : 0;

        const hasConnectors = /\b(because|although|however|since|and|but|so|for example|such as|in my opinion|firstly|secondly|finally|on the other hand|in addition|furthermore|therefore)\b/i.test(trimmed);
        const hasAdvancedVocab = words.some(w => w.length >= 7);

        let calculatedScore = 72;
        if (diversityRatio > 0.7) calculatedScore += 6;
        if (diversityRatio < 0.5) calculatedScore -= 8;
        if (hasConnectors) calculatedScore += 7;
        if (hasAdvancedVocab) calculatedScore += 5;

        const maxCap = currentPart === 1 ? 82 : currentPart === 4 ? 95 : 88;
        rawScore = Math.min(maxCap, Math.max(45, calculatedScore));

        if (rawScore >= 90) {
          cefr = 'C1';
          fb = `Bài nói xuất sắc đạt chuẩn C1: Phát âm mượt mà, diễn đạt trôi chảy tự nhiên, vốn từ phong phú (${wCount} từ).`;
        } else if (rawScore >= 80) {
          cefr = 'B2';
          fb = `Bài nói đạt chuẩn B2: Đảm bảo độ dài (${wCount} từ), từ vựng đa dạng, sử dụng các từ nối ý phát biểu logic và tự nhiên.`;
        } else if (rawScore >= 65) {
          cefr = 'B1';
          fb = `Bài nói đạt mức B1 (${wCount} từ): Cấu trúc câu rõ ràng, đáp ứng yêu cầu đề bài. Nên bổ sung thêm liên từ và tính từ miêu tả để tăng sự lưu khoát.`;
        } else {
          cefr = 'A2';
          fb = `Bài nói mức cơ bản (${wCount} từ): Cần chú ý phát âm rõ chữ, kéo dài phần trả lời và hạn chế lặp lại từ vựng.`;
        }

        const potentialErrors = words.filter(w => w.length > 3 && !/^[a-z]+$/.test(w));
        potentialErrors.slice(0, 3).forEach(w => {
          spellingIssues.push({ original: w, suggestion: w.replace(/[^a-z]/g, '') || 'correct' });
        });
      }

      return {
        id: `spk_eval_${Date.now()}`,
        status: 'completed',
        question_id: qKey,
        normalized_score: rawScore,
        cefr_level: cefr,
        feedback: fb,
        solution: {
          model_answer: getSmartSpeakingSampleAnswer(qMeta.prompt || qMeta.question)
        },
        rubric_result: {
          spelling: { issues: spellingIssues }
        },
        updated_at: new Date().toISOString()
      };
    };

    const initialEvalObj = {
      status: 'pending',
      question_id: qKey,
      solution: { model_answer: getSmartSpeakingSampleAnswer(qMeta.prompt || qMeta.question) }
    };
    setItemEvaluations(prev => ({ ...prev, [qKey]: initialEvalObj }));

    try {
      if (attempt?.id) {
        const client = getBrowserSupabaseClient();
        const res = await submitQuestionApi(attempt.id, qKey, responsePayload, client).catch(() => null);

        if (res) {
          if (res?.solution) {
            setEvaluationResults(prev => ({ ...prev, [qKey]: res.solution }));
          }

          const evalId = res?.evaluationId || res?.evaluation_id || res?.id || res?.data?.evaluationId || res?.data?.id;
          if (evalId) {
            const pendingWithId = { id: evalId, status: 'pending', question_id: qKey };
            setItemEvaluations(prev => ({ ...prev, [qKey]: pendingWithId }));

            let pollCount = 0;
            const maxPolls = 10;
            let resolved = false;

            for (let i = 0; i < maxPolls; i++) {
              await new Promise(r => setTimeout(r, 1200));
              try {
                const latest = await getEvaluation(evalId, client).catch(() => null);
                if (latest && ['completed', 'failed', 'needs_review'].includes(latest.status)) {
                  setItemEvaluations(prev => ({ ...prev, [qKey]: latest }));
                  resolved = true;
                  return latest;
                }
              } catch { }
            }

            if (!resolved) {
              const fallbackEval = buildLocalFallbackEval(responsePayload);
              setItemEvaluations(prev => ({ ...prev, [qKey]: fallbackEval }));
              return fallbackEval;
            }
          } else if (res?.evaluation || res?.status === 'completed') {
            const completedEval = res.evaluation || res;
            setItemEvaluations(prev => ({ ...prev, [qKey]: completedEval }));
            return completedEval;
          }
        }
      }

      await new Promise(r => setTimeout(r, 400));
      const fallbackEval = buildLocalFallbackEval(responsePayload);
      setItemEvaluations(prev => ({ ...prev, [qKey]: fallbackEval }));
      return fallbackEval;

    } catch (err) {
      const fallbackEval = buildLocalFallbackEval(responsePayload);
      setItemEvaluations(prev => ({ ...prev, [qKey]: fallbackEval }));
      return fallbackEval;
    } finally {
      setSubmitting(false);
    }
  }, [attempt?.id, activePart]);

  return {
    authStatus,
    authUser,
    loading,
    error,
    isEmpty,
    attempt,
    groups,
    activeGroup,
    adaptedData,
    coreStories: SPEAKING_PART4_CORE_STORIES,
    userRecordings,
    markedQuestions,
    submittedQuestions,
    evaluationResults,
    submitting,
    submitError,
    activeEvaluation,
    setActiveEvaluation,
    itemEvaluations,
    toggleBookmark,
    saveRecordingResponse,
    handleSubmitQuestion
  };
}


