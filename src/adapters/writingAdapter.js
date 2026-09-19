/**
 * Aptis Writing Data Adapter (Phase 6B3)
 * Safely transforms public database question rows (sanitized by aptisService)
 * into exact view models required by Writing Part UI components.
 * 
 * SECURITY GUARANTEE:
 * Does NOT accept or process correct_answer, model_answer, sample_answer, rubric, or solution_data.
 */

/**
 * Clean HTML tags from string
 */
export function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Real-time word counter logic
 * - Trims whitespace
 * - Handles multiple spaces and newlines
 * - Contractions like "don't" count as 1 word
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Resolve word limits from DB metadata, ui_config, or instruction text.
 * Falls back to Aptis standard limits if unspecified.
 */
export function resolveWordLimit(q, defaultMin, defaultMax) {
  let minWords = q?.metadata?.min_words ?? q?.ui_config?.min_words ?? null;
  let maxWords = q?.metadata?.max_words ?? q?.ui_config?.max_words ?? null;

  if (minWords !== null && maxWords !== null) {
    return { minWords: Number(minWords), maxWords: Number(maxWords), wordLimitSource: 'database' };
  }

  // Attempt to parse range from content/instruction text e.g. "20–30 words" or "40-50 words"
  const contentText = q?.content || '';
  const rangeMatch = contentText.match(/(\d+)\s*[-–—to]\s*(\d+)\s*words/i);
  if (rangeMatch) {
    return {
      minWords: Number(rangeMatch[1]),
      maxWords: Number(rangeMatch[2]),
      wordLimitSource: 'database'
    };
  }

  const singleMatch = contentText.match(/about\s*(\d+)\s*words/i);
  if (singleMatch) {
    const target = Number(singleMatch[1]);
    return {
      minWords: Math.max(1, target - 5),
      maxWords: target + 5,
      wordLimitSource: 'database'
    };
  }

  return { minWords: defaultMin, maxWords: defaultMax, wordLimitSource: 'fallback' };
}

export function resolveGroupName(clubKey, firstQ, groupParam, defaultFallback = 'WRITING CLUB') {
  let matchedGroup = null;
  if (Array.isArray(groupParam)) {
    matchedGroup = groupParam.find(
      g => g.group_key === clubKey ||
           g.group_key === firstQ?.metadata?.club_key ||
           g.id === firstQ?.metadata?.group_id
    );
  } else if (groupParam && typeof groupParam === 'object') {
    matchedGroup = groupParam;
  }

  if (matchedGroup?.name) return matchedGroup.name;
  if (firstQ?.metadata?.club_name) return firstQ.metadata.club_name;
  if (firstQ?.metadata?.club_title) return firstQ.metadata.club_title;
  if (firstQ?.metadata?.topic) return firstQ.metadata.topic;
  if (firstQ?.passage?.title) return firstQ.passage.title;

  if (clubKey && typeof clubKey === 'string') {
    const cleanKey = clubKey.replace(/^writing-p\d+-/i, '').replace(/^writing-club-/i, '').replace(/[-_]/g, ' ');
    if (cleanKey) {
      return cleanKey.replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  return defaultFallback;
}

/**
 * 1. Part 1 Adapter: Word-level short responses (5 questions per club)
 */
export function adaptWritingPart1Data(questions = [], group = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  // Group questions by club/group_key
  const clubGroupsMap = new Map();

  questions.forEach((q) => {
    const clubKey = q.metadata?.club_key || (q.source_key ? q.source_key.replace(/-p1-q\d+$/i, '') : '') || group?.group_key || 'writing-club-default';
    if (!clubGroupsMap.has(clubKey)) {
      clubGroupsMap.set(clubKey, []);
    }
    clubGroupsMap.get(clubKey).push(q);
  });

  const clubs = [];

  for (const [clubKey, chunkQuestions] of clubGroupsMap.entries()) {
    const sortedQuestions = [...chunkQuestions].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const firstQ = sortedQuestions[0];
    const groupName = resolveGroupName(clubKey, firstQ, group, 'PHOTOGRAPHY CLUB');

    const formattedPrompts = sortedQuestions.map((q, idx) => {
      const limits = resolveWordLimit(q, 1, 5);
      return {
        id: q.id,
        sourceKey: q.source_key,
        prompt: cleanHtml(q.content),
        displayOrder: q.display_order || (idx + 1),
        minWords: limits.minWords,
        maxWords: limits.maxWords,
        wordLimitSource: limits.wordLimitSource,
        metadata: q.metadata || {},
        uiConfig: q.ui_config || {}
      };
    });

    clubs.push({
      id: `writing-p1-club-${clubKey}`,
      groupKey: clubKey,
      groupName,
      topic: groupName,
      clubName: groupName,
      prompts: formattedPrompts.map(p => p.prompt),
      questions: formattedPrompts
    });
  }

  return clubs;
}

/**
 * 2. Part 2 Adapter: Short Text Writing (1 task per club, 20–30 words)
 */
export function adaptWritingPart2Data(questions = [], group = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const clubGroupsMap = new Map();

  questions.forEach((q) => {
    const clubKey = q.metadata?.club_key || (q.source_key ? q.source_key.replace(/-p2-q\d+$/i, '') : '') || group?.group_key || 'writing-club-default';
    if (!clubGroupsMap.has(clubKey)) {
      clubGroupsMap.set(clubKey, []);
    }
    clubGroupsMap.get(clubKey).push(q);
  });

  const clubs = [];

  for (const [clubKey, chunkQuestions] of clubGroupsMap.entries()) {
    const firstQ = chunkQuestions[0];
    const groupName = resolveGroupName(clubKey, firstQ, group, 'TRAVEL CLUB');
    const limits = resolveWordLimit(firstQ, 20, 30);

    clubs.push({
      id: firstQ.id,
      groupKey: clubKey,
      groupName,
      clubName: groupName,
      instruction: 'Club message response',
      prompt: cleanHtml(firstQ.content),
      minWords: limits.minWords,
      maxWords: limits.maxWords,
      wordLimitSource: limits.wordLimitSource,
      suggestedTime: '7 minutes',
      question: firstQ
    });
  }

  return clubs;
}

/**
 * 3. Part 3 Adapter: Chat Responses (3 messages per club, 30–40 words each)
 */
export function adaptWritingPart3Data(questions = [], group = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const clubGroupsMap = new Map();

  questions.forEach((q) => {
    const clubKey = q.metadata?.club_key || (q.source_key ? q.source_key.replace(/-p3-q\d+$/i, '') : '') || group?.group_key || 'writing-club-default';
    if (!clubGroupsMap.has(clubKey)) {
      clubGroupsMap.set(clubKey, []);
    }
    clubGroupsMap.get(clubKey).push(q);
  });

  const clubs = [];

  for (const [clubKey, chunkQuestions] of clubGroupsMap.entries()) {
    const sortedQuestions = [...chunkQuestions].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const firstQ = sortedQuestions[0];
    const groupName = resolveGroupName(clubKey, firstQ, group, 'MUSIC CLUB');

    const formattedQuestions = sortedQuestions.map((q, idx) => {
      const limits = resolveWordLimit(q, 30, 40);
      return {
        id: q.id,
        sourceKey: q.source_key,
        prompt: cleanHtml(q.content),
        displayOrder: q.display_order || (idx + 1),
        minWords: limits.minWords,
        maxWords: limits.maxWords,
        wordLimitSource: limits.wordLimitSource,
        metadata: q.metadata || {}
      };
    });

    clubs.push({
      id: `writing-p3-club-${clubKey}`,
      groupKey: clubKey,
      groupName,
      clubName: groupName,
      instruction: 'Respond to 3 club members in 30–40 words each.',
      context: `Chat discussion in ${groupName}`,
      prompts: formattedQuestions.map(q => q.prompt),
      questions: formattedQuestions
    });
  }

  return clubs;
}

/**
 * 4. Part 4 Adapter: Email Writing (Informal & Formal email pair per club)
 */
export function adaptWritingPart4Data(questions = [], group = null) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const clubGroupsMap = new Map();

  questions.forEach((q) => {
    const clubKey = q.metadata?.club_key || (q.source_key ? q.source_key.replace(/-p4-q\d+$/i, '') : '') || group?.group_key || 'writing-club-default';
    if (!clubGroupsMap.has(clubKey)) {
      clubGroupsMap.set(clubKey, []);
    }
    clubGroupsMap.get(clubKey).push(q);
  });

  const clubs = [];

  for (const [clubKey, chunkQuestions] of clubGroupsMap.entries()) {
    const firstQ = chunkQuestions[0];
    const groupName = resolveGroupName(clubKey, firstQ, group, 'FITNESS & SPORTS CLUB');

    // Extract instruction content block (Club notice / scenario)
    let instructionBlock = null;
    let scenarioText = null;

    for (const q of chunkQuestions) {
      const cb = (q.content_blocks || []).find(b => b.block_type === 'instructions' || b.block_type === 'passage');
      if (cb && cb.content) {
        instructionBlock = cb;
        scenarioText = cleanHtml(cb.content);
        break;
      }
    }

    if (!scenarioText) {
      scenarioText = firstQ?.metadata?.scenario || firstQ?.metadata?.instructions || 'Read the club notice and write 2 emails as instructed.';
    }

    // Identify informal and formal email questions
    let informalQ = chunkQuestions.find(q =>
      q.metadata?.task_type === 'informal_email' ||
      q.metadata?.tone === 'informal' ||
      q.metadata?.recipient_type === 'friend' ||
      /\binformal\b|\bfriend\b|40-50/i.test(q.content || '')
    );

    let formalQ = chunkQuestions.find(q =>
    ((q.metadata?.task_type === 'formal_email' ||
      q.metadata?.tone === 'formal' ||
      q.metadata?.recipient_type === 'manager' ||
      /\bformal\b|\bmanager\b|\bpresident\b|120-150/i.test(q.content || '')) &&
      q !== informalQ)
    );

    // Controlled fallback by display_order if specific metadata wasn't set
    if (!informalQ && chunkQuestions[0]) informalQ = chunkQuestions[0];
    if (!formalQ && chunkQuestions[1]) formalQ = chunkQuestions[1];

    if (!informalQ || !formalQ) {
      console.warn(`[Writing Adapter Anomaly] Group '${clubKey}' does not have a complete informal/formal email pair.`);
    }

    const informalLimits = informalQ ? resolveWordLimit(informalQ, 40, 50) : { minWords: 40, maxWords: 50, wordLimitSource: 'fallback' };
    const formalLimits = formalQ ? resolveWordLimit(formalQ, 120, 150) : { minWords: 120, maxWords: 150, wordLimitSource: 'fallback' };

    clubs.push({
      id: `writing-p4-club-${clubKey}`,
      groupKey: clubKey,
      groupName,
      clubName: groupName,
      scenario: scenarioText,
      instructionBlock,
      informalEmail: informalQ ? {
        questionId: informalQ.id,
        sourceKey: informalQ.source_key,
        recipient: informalQ.metadata?.recipient_type || 'friend',
        prompt: cleanHtml(informalQ.content),
        minWords: informalLimits.minWords,
        maxWords: informalLimits.maxWords,
        wordLimitSource: informalLimits.wordLimitSource
      } : null,
      formalEmail: formalQ ? {
        questionId: formalQ.id,
        sourceKey: formalQ.source_key,
        recipient: formalQ.metadata?.recipient_type || 'manager',
        toEmail: formalQ.metadata?.to_email || 'club@greenfuture.org',
        subject: formalQ.metadata?.subject || 'Notice response & feedback',
        prompt: cleanHtml(formalQ.content),
        minWords: formalLimits.minWords,
        maxWords: formalLimits.maxWords,
        wordLimitSource: formalLimits.wordLimitSource
      } : null,
      // Pass-through for UI renderer compatibility
      taskInformal: informalQ ? cleanHtml(informalQ.content) : '',
      taskFormal: formalQ ? cleanHtml(formalQ.content) : '',
      toEmail: formalQ?.metadata?.to_email || 'club@greenfuture.org',
      subject: formalQ?.metadata?.subject || 'Notice response & feedback'
    });
  }

  return clubs;
}
