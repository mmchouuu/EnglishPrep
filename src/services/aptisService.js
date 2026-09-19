import { getBrowserSupabaseClient } from '../lib/supabaseClient.js';

/**
 * Public Practice Data Service (Phase 5)
 * Security Rule: Never fetches private solution data before submission.
 */

export const APTIS_SKILLS = ['reading', 'listening', 'speaking', 'writing'];

/**
 * 1. Get list of available skills
 */
export async function getSkills() {
  return APTIS_SKILLS;
}

/**
 * 2. Get active parts for a skill
 */
export async function getParts(skill, client = null) {
  if (!APTIS_SKILLS.includes(skill)) {
    throw new Error(`Invalid skill: ${skill}`);
  }

  const supabaseClient = client || getBrowserSupabaseClient();

  const { data, error } = await supabaseClient
    .from('aptis_questions')
    .select('part_number')
    .eq('skill', skill)
    .order('part_number', { ascending: true });

  if (error) throw new Error(`Failed to fetch parts for ${skill}: ${error.message}`);

  const parts = Array.from(new Set((data || []).map(item => item.part_number)));
  return parts;
}

/**
 * 3. Get groups (clubs, topics, practice_sets) for a skill
 */
export async function getGroups(skill, partNumber = null, groupType = null, client = null) {
  if (!APTIS_SKILLS.includes(skill)) {
    throw new Error(`Invalid skill: ${skill}`);
  }

  const supabaseClient = client || getBrowserSupabaseClient();

  let query = supabaseClient
    .from('aptis_groups')
    .select('id, skill, group_type, group_key, name, description, display_order, metadata')
    .eq('skill', skill)
    .order('display_order', { ascending: true });

  if (groupType) {
    query = query.eq('group_type', groupType);
  }

  if (partNumber) {
    if (skill === 'listening') {
      if (partNumber === 1 && groupType === 'topic') {
        query = query.eq('group_type', 'topic');
      } else if (partNumber === 1 && groupType === 'practice_set') {
        query = query.ilike('group_key', 'listening-p1-set%');
      } else if (partNumber === 1) {
        query = query.or(`group_key.ilike.listening-p1-set%,group_type.eq.topic`);
      } else {
        query = query.ilike('group_key', `listening-p${partNumber}-set%`);
      }
    } else if (skill === 'writing') {
      // Writing groups are clubs (group_type = 'club')
      if (groupType) {
        query = query.eq('group_type', groupType);
      }
    } else {
      query = query.or(`group_key.ilike.${skill}-p${partNumber}-set%,group_key.ilike.${skill}-p${partNumber}-topic%,group_key.ilike.${skill}-p${partNumber}-core%,metadata->>part_number.eq.${partNumber}`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch groups for ${skill}: ${error.message}`);
  return data || [];
}

/**
 * 4. Get question count metrics by skill/part/group
 */
export async function getQuestionCounts(skill, partNumber = null, groupId = null, client = null) {
  const supabaseClient = client || getBrowserSupabaseClient();

  let query = supabaseClient
    .from('aptis_questions')
    .select('id', { count: 'exact', head: true })
    .eq('skill', skill);

  if (partNumber) {
    query = query.eq('part_number', partNumber);
  }

  if (groupId) {
    const { data: qgData } = await supabaseClient
      .from('aptis_question_groups')
      .select('question_id')
      .eq('group_id', groupId);

    const qIds = (qgData || []).map(r => r.question_id);
    if (qIds.length === 0) return 0;
    query = query.in('id', qIds);
  }

  const { count, error } = await query;
  if (error) throw new Error(`Failed to get question count: ${error.message}`);
  return count || 0;
}

/**
 * 5. Get paginated public questions with options and content blocks
 * STRICT PUBLIC BOUNDARY: Excludes correct_answer, model_answer, explanation, solution_data!
 */
export async function getQuestions(filters = {}, page = 1, pageSize = 10, client = null) {
  const { skill, partNumber, groupKey, groupId } = filters;

  if (!skill || !APTIS_SKILLS.includes(skill)) {
    throw new Error(`Skill filter is required and must be valid.`);
  }

  const supabaseClient = client || getBrowserSupabaseClient();
  let questionIdsFilter = null;
  let writingClubFilter = null;

  if (groupId || groupKey) {
    let gId = groupId;
    let gKey = groupKey;

    if (!gId && gKey) {
      const { data: groupData } = await supabaseClient
        .from('aptis_groups')
        .select('id, group_key')
        .eq('group_key', gKey)
        .maybeSingle();
      if (groupData) {
        gId = groupData.id;
      }
    }

    if (gId) {
      const { data: qgData } = await supabaseClient
        .from('aptis_question_groups')
        .select('question_id')
        .eq('group_id', gId);

      if (qgData && qgData.length > 0) {
        questionIdsFilter = qgData.map(r => r.question_id);
      }
    }

    if (!questionIdsFilter && skill === 'writing' && groupKey) {
      const cleanClub = groupKey.replace(/^writing-club-/i, '').replace(/^writing-p\d+-/i, '');
      writingClubFilter = { groupKey, cleanClub };
    }
  }

  let countQuery = supabaseClient
    .from('aptis_questions')
    .select('id', { count: 'exact', head: true })
    .eq('skill', skill);

  if (partNumber) countQuery = countQuery.eq('part_number', partNumber);
  if (questionIdsFilter) {
    countQuery = countQuery.in('id', questionIdsFilter);
  } else if (writingClubFilter) {
    const { groupKey: gK, cleanClub: cC } = writingClubFilter;
    countQuery = countQuery.or(`metadata->>club_key.eq.${gK},source_key.ilike.%${cC}%`);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(`Failed to count questions: ${countError.message}`);

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseClient
    .from('aptis_questions')
    .select(`
      id,
      skill,
      part_number,
      question_type,
      source_key,
      content,
      display_order,
      ui_config,
      metadata,
      aptis_question_options (
        id, question_id, option_key, content, display_order, metadata
      ),
      aptis_question_content_blocks (
        content_role, display_order,
        aptis_content_blocks (
          id, block_type, title, content, media_url, metadata
        )
      ),
      aptis_question_answers (
        correct_answer, explanation, solution_data
      )
    `)
    .eq('skill', skill)
    .order('source_key', { ascending: true })
    .order('display_order', { ascending: true })
    .range(from, to);

  if (partNumber) query = query.eq('part_number', partNumber);
  if (questionIdsFilter) {
    query = query.in('id', questionIdsFilter);
  } else if (writingClubFilter) {
    const { groupKey: gK, cleanClub: cC } = writingClubFilter;
    query = query.or(`metadata->>club_key.eq.${gK},source_key.ilike.%${cC}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch questions: ${error.message}`);

  const formattedData = (data || []).map(q => formatSkillPayload(q));

  return {
    data: formattedData,
    total,
    page,
    pageSize,
    totalPages
  };
}

/**
 * 6. Get complete practice set by group_key
 */
export async function getPracticeSet(groupKey, client = null) {
  const supabaseClient = client || getBrowserSupabaseClient();

  const { data: group, error: gError } = await supabaseClient
    .from('aptis_groups')
    .select('id, skill, group_type, group_key, name, description, display_order, metadata')
    .eq('group_key', groupKey)
    .single();

  if (gError || !group) {
    throw new Error(`Practice set not found for group_key: ${groupKey}`);
  }

  const qResult = await getQuestions({ skill: group.skill, groupId: group.id }, 1, 100, supabaseClient);

  return {
    group,
    questions: qResult.data,
    total_questions: qResult.total
  };
}

export function normalizeCorrectAnswer(raw) {
  if (raw === null || raw === undefined) return null;
  let val = raw;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        val = JSON.parse(trimmed);
      } catch (e) {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }

  if (typeof val === 'object' && val !== null) {
    if (val.correct_option !== undefined) return normalizeCorrectAnswer(val.correct_option);
    if (val.correct_answer !== undefined) return normalizeCorrectAnswer(val.correct_answer);
    if (val.correct_person !== undefined) return normalizeCorrectAnswer(val.correct_person);
    if (val.correct_heading !== undefined) return normalizeCorrectAnswer(val.correct_heading);
    if (val.answer !== undefined) return normalizeCorrectAnswer(val.answer);
    if (val.option_key !== undefined) return normalizeCorrectAnswer(val.option_key);
    if (val.match !== undefined) return normalizeCorrectAnswer(val.match);
    if (Array.isArray(val.ordered_keys)) return val.ordered_keys.map(k => String(k));
    if (Array.isArray(val)) return val.map(k => String(k));
  }

  return val;
}

/**
 * Formats raw DB question row into sanitized public payload per skill rules
 */
export function formatSkillPayload(qRow) {
  const options = (qRow.aptis_question_options || []).sort((a, b) => a.display_order - b.display_order);

  const contentBlocks = (qRow.aptis_question_content_blocks || []).map(j => {
    const cb = j.aptis_content_blocks;
    return {
      id: cb ? cb.id : '',
      block_type: cb ? cb.block_type : j.content_role,
      source_key: cb ? cb.source_key : '',
      title: cb ? cb.title : null,
      content: cb ? cb.content : null,
      media_url: cb ? cb.media_url : null,
      metadata: cb ? cb.metadata : {},
      missing_media: cb ? !cb.media_url && !cb.content : true
    };
  });

  const answersObj = Array.isArray(qRow.aptis_question_answers)
    ? (qRow.aptis_question_answers[0] || {})
    : (qRow.aptis_question_answers || {});

  const rawCorrect = answersObj.correct_answer !== undefined 
    ? answersObj.correct_answer 
    : (qRow.correct_answer !== undefined 
        ? qRow.correct_answer 
        : (qRow.metadata?.correct_answer || qRow.metadata?.correct_option || qRow.metadata?.answer));

  const correctAnswer = normalizeCorrectAnswer(rawCorrect);
  const explanation = answersObj.explanation || qRow.explanation || qRow.metadata?.explanation || null;
  const solutionData = answersObj.solution_data || qRow.solution_data || qRow.metadata?.solution_data || null;

  const basePayload = {
    id: qRow.id,
    skill: qRow.skill,
    part_number: qRow.part_number,
    question_type: qRow.question_type,
    source_key: qRow.source_key,
    content: qRow.content,
    display_order: qRow.display_order,
    ui_config: qRow.ui_config || {},
    metadata: qRow.metadata || {},
    options,
    content_blocks: contentBlocks,
    contentBlocks: contentBlocks,
    correct_answer: correctAnswer,
    explanation,
    solution_data: solutionData
  };

  // Defense-in-depth sanitization: Strip subjective evaluation / model answers for writing & speaking
  delete basePayload.answer;
  delete basePayload.model_answer;
  delete basePayload.sample_answer;
  delete basePayload.transcript;
  delete basePayload.rubric;
  delete basePayload.ai_feedback;
  delete basePayload.score;
  delete basePayload.is_correct;

  if (qRow.skill === 'reading') {
    const passage = contentBlocks.find(b => b.block_type === 'passage') || null;
    return {
      ...basePayload,
      passage,
      ordering_metadata: qRow.metadata?.ordering || null,
      matching_metadata: qRow.metadata?.matching || null
    };
  }

  if (qRow.skill === 'listening') {
    const audio = contentBlocks.find(b => b.block_type === 'audio') || null;
    return {
      ...basePayload,
      audio,
      missing_audio: !audio || !audio.media_url
    };
  }

  if (qRow.skill === 'speaking') {
    const image = contentBlocks.find(b => b.block_type === 'image') || null;
    return {
      ...basePayload,
      prompt: qRow.content,
      prep_time: qRow.ui_config?.prep_time_seconds || 30,
      speak_time: qRow.ui_config?.speak_time_seconds || 45,
      image,
      recording_required: true
    };
  }

  if (qRow.skill === 'writing') {
    return {
      ...basePayload,
      prompt: qRow.content,
      min_words: qRow.ui_config?.min_words || null,
      max_words: qRow.ui_config?.max_words || null,
      tone: qRow.ui_config?.tone || null,
      recipient: qRow.ui_config?.recipient || null,
      word_counter_enabled: true
    };
  }

  return basePayload;
}
