import { submitResponse, submitAttempt as submitAttemptBoundary } from './evaluationApiClient.js';

/**
 * Client Submission Service
 * Scope: Legacy frontend wrapper delegating to evaluationApiClient boundary.
 */

export async function submitQuestion(attemptId, questionId, userResponse, client = null) {
  return submitResponse({ attemptId, questionId, response: userResponse }, client);
}

export async function submitAttempt(attemptId, client = null) {
  return submitAttemptBoundary({ attemptId }, client);
}
