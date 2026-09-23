import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

/**
 * Standardized Evaluation API Boundary Client
 * Scope: Decouples React Frontend from Supabase Edge Functions / ASP.NET Core C# Backend.
 * Configuration: Controlled via `VITE_EVALUATION_API_MODE` ('supabase' | 'custom_http').
 */

export const EVALUATION_API_MODE = (import.meta.env?.VITE_EVALUATION_API_MODE) || 'supabase';

/**
 * 2. Submit attempt session
 */
export async function submitAttempt(payload, client = null) {
  const { attemptId } = payload;
  if (!attemptId) {
    throw new Error('Attempt ID is required for attempt submission.');
  }

  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient.functions.invoke('submit-practice', {
    body: {
      action: 'submit_attempt',
      attempt_id: attemptId
    }
  });

  if (error) {
    throw new Error(`Attempt submission failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`[SUBMISSION_ERROR] ${data.error}`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aptis:attempt-submitted', { detail: { attemptId, data } }));
  }

  return data;
}

/**
 * 3. Fetch single evaluation record by ID (Edge Function query)
 */
export async function getEvaluation(evaluationId, client = null) {
  if (!evaluationId) throw new Error('Evaluation ID is required.');
  const supabaseClient = client || getBrowserSupabaseClient();

  try {
    const { data: fnData } = await supabaseClient.functions.invoke('submit-practice', {
      body: {
        action: 'get_evaluation',
        evaluation_id: evaluationId
      }
    });

    if (fnData?.evaluation) {
      return fnData.evaluation;
    }
  } catch {}

  return null;
}

export function normalizeObjectiveResult(serverResponse) {
  if (!serverResponse || typeof serverResponse !== 'object') {
    throw new Error('OBJECTIVE_RESPONSE_CONTRACT_ERROR: Server response is null or not an object.');
  }

  if (serverResponse.success !== true) {
    throw new Error(`OBJECTIVE_RESPONSE_CONTRACT_ERROR: Response success flag is not true (${serverResponse.error || 'unknown'}).`);
  }

  const resp = serverResponse.response || {};
  const evalData = serverResponse.evaluation || {};
  const solData = serverResponse.solution || {};

  return {
    success: true,
    responseId: String(resp.id || serverResponse.responseId || evalData.response_id || 'resp_unknown'),
    attemptId: String(resp.attempt_id || serverResponse.attemptId || evalData.attempt_id || 'att_unknown'),
    questionId: String(resp.question_id || serverResponse.questionId || evalData.question_id || 'q_unknown'),
    evaluationId: String(evalData.id || serverResponse.evaluationId || 'eval_unknown'),
    status: evalData.status || serverResponse.evaluationStatus || 'completed',
    isCorrect: typeof evalData.is_correct === 'boolean' ? evalData.is_correct : ((evalData.score || evalData.raw_score || 0) > 0),
    rawScore: typeof evalData.raw_score === 'number' ? evalData.raw_score : (evalData.score || 0),
    maxScore: typeof evalData.max_score === 'number' ? evalData.max_score : 1,
    normalizedScore: typeof evalData.normalized_score === 'number' ? evalData.normalized_score : (evalData.score || 0),
    feedback: evalData.feedback || null,
    correctAnswer: solData.correct_answer || null,
    explanation: solData.explanation || null,
    solutionData: solData.solution_data || null
  };
}

/**
 * 1. Submit single response (question level)
 */
export async function submitResponse(payload, client = null) {
  const { attemptId, questionId, response } = payload;
  if (!attemptId || !questionId) {
    throw new Error('Attempt ID and Question ID are required for response submission.');
  }

  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient.functions.invoke('submit-practice', {
    body: {
      action: 'submit_question',
      attempt_id: attemptId,
      question_id: questionId,
      response: response
    }
  });

  if (error) {
    throw new Error(`Evaluation submission failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`[SUBMISSION_ERROR] ${data.error}`);
  }

  // Handle Subjective (Writing / Speaking) Pending 202 Response Contract
  if (data?.evaluationStatus === 'pending' || (data?.evaluationId && !data?.evaluation?.is_correct && data?.evaluation?.status !== 'completed')) {
    return {
      success: true,
      evaluationId: data.evaluationId,
      evaluationStatus: 'pending',
      responseId: data.responseId,
      attemptId: data.attemptId,
      solution: data.solution || null
    };
  }

  return normalizeObjectiveResult(data);
}

/**
 * 4. Fetch evaluation statuses for all responses in an attempt (Edge Function query)
 */
export async function getAttemptEvaluationStatus(attemptId, client = null) {
  if (!attemptId) throw new Error('Attempt ID is required.');
  const supabaseClient = client || getBrowserSupabaseClient();

  try {
    const { data: fnData } = await supabaseClient.functions.invoke('submit-practice', {
      body: {
        action: 'get_attempt_evaluations',
        attempt_id: attemptId
      }
    });

    if (fnData?.evaluations) {
      return fnData.evaluations;
    }
  } catch {}

  return [];
}


