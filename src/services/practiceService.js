import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

/**
 * User Practice Management Service (Phase 5)
 * Scope: User practice session attempts, response autosaving, and bookmarks
 * Security Rule: Enforces user isolation (auth.uid() = user_id) and prevents client score/status tampering.
 */

/**
 * 1. Create a new practice attempt for the current authenticated user
 */
export async function createAttempt(userId, skill, practiceMode = 'full_skill', partNumber = null, groupId = null, client = null) {
  if (!userId) throw new Error(`User ID is required to create a practice attempt.`);
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient
    .from('practice_attempts')
    .insert({
      user_id: userId,
      skill,
      practice_mode: practiceMode,
      part_number: partNumber,
      group_id: groupId,
      status: 'in_progress'
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create practice attempt: ${error.message}`);
  return data;
}

/**
 * 2. Get attempts for a specific user
 */
export async function getUserAttempts(userId, client = null) {
  if (!userId) throw new Error(`User ID is required.`);
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient
    .from('practice_attempts')
    .select(`
      id,
      skill,
      practice_mode,
      part_number,
      group_id,
      status,
      total_score,
      started_at,
      submitted_at,
      aptis_groups ( name, group_type )
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch user attempts: ${error.message}`);
  return data || [];
}

/**
 * 3. Get attempt details and saved responses
 */
export async function getAttemptDetails(attemptId, userId, client = null) {
  if (!attemptId || !userId) throw new Error(`Attempt ID and User ID are required.`);
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data: attempt, error: aError } = await supabaseClient
    .from('practice_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (aError || !attempt) {
    throw new Error(`Attempt not found or unauthorized access: ${aError?.message}`);
  }

  const { data: responses, error: rError } = await supabaseClient
    .from('practice_responses')
    .select('*')
    .eq('attempt_id', attemptId);

  if (rError) throw new Error(`Failed to fetch responses for attempt: ${rError.message}`);

  return {
    attempt,
    responses: responses || []
  };
}

/**
 * 4. Autosave / Upsert User Response
 * Security: Verified against in_progress attempt status. Does NOT accept score or evaluation fields!
 */
export async function saveResponse(attemptId, questionId, responseData, wordCount = null, recordingPath = null, client = null) {
  if (!attemptId || !questionId) {
    throw new Error(`Attempt ID and Question ID are required to save response.`);
  }

  const supabaseClient = client || getBrowserSupabaseClient();

  const { data: attempt, error: aCheck } = await supabaseClient
    .from('practice_attempts')
    .select('status, user_id')
    .eq('id', attemptId)
    .single();

  if (aCheck || !attempt) {
    throw new Error(`Practice attempt not found.`);
  }

  if (attempt.status !== 'in_progress') {
    throw new Error(`[SECURITY_VIOLATION] Cannot modify response for an attempt that is '${attempt.status}'. Only 'in_progress' attempts can be modified.`);
  }

  const { data, error } = await supabaseClient
    .from('practice_responses')
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        response: responseData,
        word_count: wordCount,
        recording_path: recordingPath,
        answered_at: new Date().toISOString()
      },
      { onConflict: 'attempt_id, question_id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save response: ${error.message}`);
  return data;
}

/**
 * 5. Toggle Bookmark for a question
 */
export async function toggleBookmark(userId, questionId, client = null) {
  if (!userId || !questionId) throw new Error(`User ID and Question ID are required.`);
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data: existing } = await supabaseClient
    .from('question_bookmarks')
    .select('question_id')
    .eq('user_id', userId)
    .eq('question_id', questionId)
    .maybeSingle();

  if (existing) {
    const { error: dErr } = await supabaseClient
      .from('question_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('question_id', questionId);

    if (dErr) throw new Error(`Failed to remove bookmark: ${dErr.message}`);
    return { bookmarked: false };
  } else {
    const { error: iErr } = await supabaseClient
      .from('question_bookmarks')
      .insert({ user_id: userId, question_id: questionId });

    if (iErr) throw new Error(`Failed to add bookmark: ${iErr.message}`);
    return { bookmarked: true };
  }
}

/**
 * 6. Get User Bookmarks
 */
export async function getUserBookmarks(userId, client = null) {
  if (!userId) throw new Error(`User ID is required.`);
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient
    .from('question_bookmarks')
    .select(`
      created_at,
      aptis_questions (
        id, skill, part_number, question_type, source_key, content
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch bookmarks: ${error.message}`);
  return data || [];
}


