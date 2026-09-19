import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

/**
 * Dashboard Statistics Service
 * Calls secure PostgreSQL RPC `get_user_dashboard_stats` restricted to auth.uid().
 */

export const EMPTY_DASHBOARD_STATS = {
  overall: {
    completedParts: 0,
    totalParts: 16,
    progressPercent: 0,
    latestScore: null,
    latestSkill: null,
    cefrLevel: null,
    studyStreakDays: 0
  },
  skills: {
    listening: {
      completedParts: 0,
      totalParts: 4,
      progressPercent: 0,
      latestScore: null,
      maxScore: 100,
      cefrLevel: null,
      evaluationStatus: null,
      latestAttemptId: null,
      latestCompletedAt: null
    },
    reading: {
      completedParts: 0,
      totalParts: 4,
      progressPercent: 0,
      latestScore: null,
      maxScore: 100,
      cefrLevel: null,
      evaluationStatus: null,
      latestAttemptId: null,
      latestCompletedAt: null
    },
    writing: {
      completedParts: 0,
      totalParts: 4,
      progressPercent: 0,
      latestScore: null,
      maxScore: 100,
      cefrLevel: null,
      evaluationStatus: null,
      latestAttemptId: null,
      latestCompletedAt: null
    },
    speaking: {
      completedParts: 0,
      totalParts: 4,
      progressPercent: 0,
      latestScore: null,
      maxScore: 100,
      cefrLevel: null,
      evaluationStatus: null,
      latestAttemptId: null,
      latestCompletedAt: null
    }
  }
};

/**
 * Fetch dashboard statistics for the currently authenticated user
 */
export async function getUserDashboardStats(client = null) {
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient.rpc('get_user_dashboard_stats');

  if (error) {
    throw new Error(`Failed to fetch dashboard statistics: ${error.message}`);
  }

  if (!data || typeof data !== 'object') {
    return EMPTY_DASHBOARD_STATS;
  }

  return {
    overall: {
      ...EMPTY_DASHBOARD_STATS.overall,
      ...(data.overall || {})
    },
    skills: {
      listening: { ...EMPTY_DASHBOARD_STATS.skills.listening, ...(data.skills?.listening || {}) },
      reading: { ...EMPTY_DASHBOARD_STATS.skills.reading, ...(data.skills?.reading || {}) },
      writing: { ...EMPTY_DASHBOARD_STATS.skills.writing, ...(data.skills?.writing || {}) },
      speaking: { ...EMPTY_DASHBOARD_STATS.skills.speaking, ...(data.skills?.speaking || {}) }
    }
  };
}
