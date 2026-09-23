import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

/**
 * User Practice Management Service (Phase 5)
 * Scope: User practice session attempts, response autosaving, and bookmarks
 * Security Rule: Enforces user isolation (auth.uid() = user_id) and prevents client score/status tampering.
 */

/**
 * Normalizes UI practice parameters into valid Database Contract parameters for practice_attempts table.
 *
 * DB practice_mode CHECK constraint allows EXACTLY:
 * - 'full_skill' (part_number = null, group_id = null)
 * - 'by_part'   (part_number = int, group_id = null)
 * - 'by_club'   (part_number = int/null, group_id = uuid)
 * - 'by_topic'  (part_number = int, group_id = uuid)
 */
export function normalizePracticeScope({ skill, mode, partNumber, groupId, groupType }) {
  const rawMode = (mode || 'full').toLowerCase().trim();
  const parsedPart = (partNumber !== null && partNumber !== undefined && partNumber !== '')
    ? parseInt(partNumber, 10)
    : null;
  const validPartNumber = (parsedPart && !isNaN(parsedPart) && parsedPart > 0) ? parsedPart : null;
  const validGroupId = (groupId && typeof groupId === 'string' && groupId.trim().length > 0) ? groupId.trim() : null;

  // 1. Full Skill / Mock Test across all parts
  if (rawMode === 'full_skill' || rawMode === 'mock_test' || rawMode === 'mock') {
    return {
      skill,
      dbPracticeMode: 'full_skill',
      dbPartNumber: null,
      dbGroupId: null
    };
  }

  // 2. Club Mode (Writing Clubs)
  if (rawMode === 'club' || rawMode === 'by_club' || rawMode === 'byclub' || groupType === 'club') {
    if (!validGroupId) {
      throw new Error(`[PRACTICE_SCOPE_ERROR] Group ID (club UUID) is required when practice_mode is 'by_club'.`);
    }
    return {
      skill,
      dbPracticeMode: 'by_club',
      dbPartNumber: validPartNumber,
      dbGroupId: validGroupId
    };
  }

  // 3. Topic / Practice Set Mode
  if (rawMode === 'topic' || rawMode === 'by_topic' || rawMode === 'bytopic' || rawMode === 'practice_set' || rawMode === 'set' || rawMode === 'core') {
    if (!validGroupId) {
      throw new Error(`[PRACTICE_SCOPE_ERROR] Group ID is required when practice_mode is 'by_topic'. Cannot silently fallback to default group.`);
    }
    return {
      skill,
      dbPracticeMode: 'by_topic',
      dbPartNumber: validPartNumber,
      dbGroupId: validGroupId
    };
  }

  // 4. Default / UI "full" -> Practice by Part
  // "Full Practice" on UI means user selected a single Part and does all questions for that Part without topic/group filters.
  return {
    skill,
    dbPracticeMode: 'by_part',
    dbPartNumber: validPartNumber || 1,
    dbGroupId: null // MUST BE NULL for Full Practice by Part
  };
}

/**
 * Finds an exact matching in_progress practice attempt for the given normalized scope.
 * Strict contract requirements:
 * - skill must match
 * - status === 'in_progress'
 * - practice_mode === scope.dbPracticeMode
 * - part_number === scope.dbPartNumber (or both null for full_skill)
 * - group_id === scope.dbGroupId (if scope.dbGroupId is null, a.group_id MUST be null; if UUID, MUST match UUID)
 */
export function findMatchingAttempt(existingAttempts, scope) {
  if (!Array.isArray(existingAttempts) || !scope) return null;
  return existingAttempts.find(a => {
    if (a.skill !== scope.skill) return false;
    if (a.status !== 'in_progress') return false;
    if (a.practice_mode !== scope.dbPracticeMode) return false;

    const matchPart = scope.dbPartNumber === null
      ? (a.part_number === null || a.part_number === undefined)
      : (Number(a.part_number) === Number(scope.dbPartNumber));

    if (!matchPart) return false;

    const matchGroup = scope.dbGroupId === null
      ? (a.group_id === null || a.group_id === undefined)
      : (a.group_id === scope.dbGroupId);

    return matchGroup;
  }) || null;
}

/**
 * 1. Create a new practice attempt for the current authenticated user
 */
export async function createAttempt(userId, skill, practiceMode = 'full_skill', partNumber = null, groupId = null, client = null) {
  if (!userId) throw new Error(`User ID is required to create a practice attempt.`);
  const supabaseClient = client || getBrowserSupabaseClient();

  const scope = normalizePracticeScope({
    skill,
    mode: practiceMode,
    partNumber,
    groupId
  });

  const { data, error } = await supabaseClient
    .from('practice_attempts')
    .insert({
      user_id: userId,
      skill: scope.skill,
      practice_mode: scope.dbPracticeMode,
      part_number: scope.dbPartNumber,
      group_id: scope.dbGroupId,
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


