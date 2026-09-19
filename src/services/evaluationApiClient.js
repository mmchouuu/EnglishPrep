import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

/**
 * Standardized Evaluation API Boundary Client
 * Scope: Decouples React Frontend from Supabase Edge Functions / ASP.NET Core C# Backend.
 * Configuration: Controlled via `VITE_EVALUATION_API_MODE` ('supabase' | 'custom_http').
 */

export const EVALUATION_API_MODE = (import.meta.env?.VITE_EVALUATION_API_MODE) || 'supabase';

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

  return data;
}

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
 * 3. Fetch single evaluation record by ID
 */
export async function getEvaluation(evaluationId, client = null) {
  if (!evaluationId) throw new Error('Evaluation ID is required.');
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient
    .from('practice_response_evaluations')
    .select('*')
    .eq('id', evaluationId)
    .single();

  if (error) throw new Error(`Failed to fetch evaluation: ${error.message}`);
  return data;
}

/**
 * 4. Fetch evaluation statuses for all responses in an attempt
 */
export async function getAttemptEvaluationStatus(attemptId, client = null) {
  if (!attemptId) throw new Error('Attempt ID is required.');
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient
    .from('practice_response_evaluations')
    .select('id, response_id, question_id, status, normalized_score, cefr_level, rubric_result, feedback, updated_at')
    .eq('attempt_id', attemptId);

  if (error) throw new Error(`Failed to fetch attempt evaluations: ${error.message}`);
  return data || [];
}
