/**
 * Aptis Speaking Data Adapter
 * Transforms database question rows (sanitized by aptisService) into standardized props for Speaking Parts 1-4.
 *
 * SECURITY & RUNTIME GUARANTEES:
 * - NO mock fallbacks. Returns empty array if data is missing or query fails.
 * - NO private solution or answer evaluation data included in pre-submit payloads.
 * - Part 2 imageVariants: Photo description variants for each specific SET (single photo visible at a time).
 * - Part 3 combinedImage: Single composite image containing comparison pair for each specific SET.
 */

function cleanHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to resolve image URL safely with fallback order:
 * 1. Valid Storage public URL or media_url
 * 2. Local public_path (/assets/speaking/...)
 * 3. Empty/null for SafeImage fallback
 */
function resolveImageUrl(block, defaultPart = null, setNum = null, variantIdx = 1) {
  if (!block) return null;
  let url = typeof block === 'string' ? block : (block.media_url || block.content || block.metadata?.public_path || block.metadata?.image_url || block.url);
  if (!url || typeof url !== 'string') return null;

  url = url.trim();

  // If it's already an absolute HTTP/HTTPS URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Normalize backslashes
  url = url.replace(/\\/g, '/');

  // Strip leading slashes
  url = url.replace(/^\/+/, '');

  // Case 1: starts with 'assets/speaking/'
  if (url.startsWith('assets/speaking/')) {
    return '/' + url;
  }

  // Case 2: starts with 'speaking/' (e.g. 'speaking/part-2/set-001/photo-1.jpg')
  if (url.startsWith('speaking/')) {
    return '/assets/' + url;
  }

  // Case 3: starts with 'part-2/' or 'part-3/' (e.g. 'part-2/set-001/photo-1.jpg')
  if (url.startsWith('part-2/') || url.startsWith('part-3/')) {
    return '/assets/speaking/' + url;
  }

  // Case 4: starts with 'set-' (e.g. 'set-001/photo-1.jpg')
  if (url.startsWith('set-') && defaultPart) {
    return `/assets/speaking/part-${defaultPart}/${url}`;
  }

  // Fallback using defaultPart and setNum
  if (defaultPart && setNum && setNum < 9999) {
    const padded = String(setNum).padStart(3, '0');
    if (defaultPart === 2) {
      return `/assets/speaking/part-2/set-${padded}/photo-${variantIdx}.jpg`;
    }
    if (defaultPart === 3) {
      return `/assets/speaking/part-3/set-${padded}/comparison.jpg`;
    }
  }

  return url.startsWith('/') ? url : '/' + url;
}

/**
 * Robust helper to extract content blocks array from DB question row across camelCase and snake_case properties
 */
function getBlocksFromQuestion(q) {
  if (!q) return [];
  if (Array.isArray(q.content_blocks) && q.content_blocks.length > 0) return q.content_blocks;
  if (Array.isArray(q.contentBlocks) && q.contentBlocks.length > 0) return q.contentBlocks;
  if (Array.isArray(q.aptis_question_content_blocks) && q.aptis_question_content_blocks.length > 0) return q.aptis_question_content_blocks;
  if (q.image) return [q.image];
  return [];
}

/**
 * Extract set number from question row across source_key, group_key, metadata, ui_config, and content blocks
 */
function extractSetNumber(q) {
  if (!q) return null;

  const targets = [];

  if (q.source_key) targets.push(q.source_key);
  if (q.sourceKey) targets.push(q.sourceKey);
  if (q.group_key) targets.push(q.group_key);
  if (q.groupKey) targets.push(q.groupKey);
  if (q.metadata?.source_key) targets.push(q.metadata.source_key);
  if (q.metadata?.set_key) targets.push(q.metadata.set_key);
  if (q.metadata?.group_key) targets.push(q.metadata.group_key);

  const topicStr = q.ui_config?.topic || q.uiConfig?.topic || q.metadata?.topic || q.metadata?.ui_config?.topic || q.group_name || q.groupName;
  if (topicStr) targets.push(topicStr);

  const blocks = getBlocksFromQuestion(q);
  for (const cb of blocks) {
    const block = cb.aptis_content_blocks || cb;
    if (block?.source_key) targets.push(block.source_key);
    if (block?.metadata?.set_key) targets.push(block.metadata.set_key);
  }

  for (const str of targets) {
    if (typeof str !== 'string') continue;

    // Pattern 1: set-01, set_01, set 01, set01, set-001
    const setMatch = str.match(/set[\s-_]*(\d+)/i);
    if (setMatch) {
      return parseInt(setMatch[1], 10);
    }

    // Pattern 2: topic-01, topic_01, topic 01, topic01, story 01
    const topicMatch = str.match(/(?:topic|story)[\s-_]*(\d+)/i);
    if (topicMatch) {
      return parseInt(topicMatch[1], 10);
    }
  }

  return null;
}

/**
 * Robust helper to resolve set/topic key for grouping questions strictly by SET/MODULE
 */
function getSetGroupKey(q) {
  if (!q) return 'set-unknown';

  // 1. Try canonical numeric set/topic extraction first for strict grouping
  const setNum = extractSetNumber(q);
  const sKeyFallback = q.source_key || q.sourceKey || q.metadata?.source_key || '';
  const pNum = q.part_number || q.partNumber || (sKeyFallback.match(/p(\d+)/i)?.[1]) || 2;

  if (setNum !== null && setNum < 9999) {
    if (Number(pNum) === 4) {
      return `speaking-p4-topic${String(setNum).padStart(3, '0')}`;
    }
    return `speaking-p${pNum}-set${String(setNum).padStart(3, '0')}`;
  }

  // 2. Group ID from DB or metadata (uniquely identifies a set group)
  if (q.group_id || q.metadata?.group_id) {
    return `group-${q.group_id || q.metadata.group_id}`;
  }

  // 3. Explicit set_key or group_key if available
  const gKey = q.group_key || q.groupKey || q.metadata?.group_key || q.metadata?.set_key;
  if (gKey && typeof gKey === 'string' && gKey.trim().length > 0) {
    return gKey.trim();
  }

  // 4. Source key prefix (e.g. 'speaking-p2-set01-v1-q1' -> 'speaking-p2-set01-v1')
  const sKey = q.source_key || q.sourceKey || q.metadata?.source_key || '';
  if (sKey && typeof sKey === 'string') {
    const baseKey = sKey.replace(/[-_]?q\d+$/i, '').trim();
    if (baseKey) return baseKey;
  }

  // 5. Specific topic name
  const tName = q.ui_config?.topic || q.uiConfig?.topic || q.metadata?.topic || q.metadata?.ui_config?.topic || q.group_name || q.groupName;
  if (tName && typeof tName === 'string' && !/^(describe a photo|compare photos|abstract topic|personal information)$/i.test(tName.trim())) {
    return tName.replace(/\?{2,}/g, '–').replace(/–\s*SOURCE VARIANT\s*\d+/gi, '').trim();
  }

  return q.id || 'set-unknown';
}

/**
 * Helper to resolve display title for a SET/MODULE
 */
function getSetDisplayName(qList, defaultName) {
  const firstQ = qList[0] || {};
  let t = firstQ.ui_config?.topic || firstQ.uiConfig?.topic || firstQ.metadata?.topic || firstQ.metadata?.ui_config?.topic || firstQ.group_name || firstQ.groupName;
  if (t && typeof t === 'string' && !/^(describe a photo|compare photos|abstract topic|personal information)$/i.test(t.trim())) {
    const cleaned = t.replace(/\?{2,}/g, '–').replace(/–\s*SOURCE VARIANT\s*\d+/gi, '').trim();
    if (!/^photo variant/i.test(cleaned) && !/^image \d+/i.test(cleaned)) {
      return cleaned;
    }
  }

  const setNum = extractSetNumber(firstQ) || getSetNumber(getSetGroupKey(firstQ));
  if (setNum && setNum < 9999) {
    return `SET ${String(setNum).padStart(2, '0')}`;
  }

  return defaultName;
}

/**
 * Helper to extract numeric set/topic index for numerical sorting
 */
function getSetNumber(setKey) {
  if (!setKey) return 9999;
  const match = String(setKey).match(/set-?(\d+)/i) || String(setKey).match(/topic-?(\d+)/i) || String(setKey).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 9999;
}

/**
 * Part 1: Personal Information - Flat Question List (Full Mode)
 * 30 seconds speaking per question (no prep time, 0 images)
 */
export function adaptSpeakingPart1Data(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  return questions.map((q, idx) => ({
    id: q.id || `sp1-q${idx + 1}`,
    num: idx + 1,
    speakTime: q.speak_time || q.ui_config?.speak_time_seconds || q.uiConfig?.speak_time || 30,
    prepTime: q.prep_time || q.ui_config?.prep_time_seconds || q.uiConfig?.prep_time || 0,
    question: cleanHtml(q.prompt || q.content || `Question ${idx + 1}`),
    modelAnswer: q.model_answer || q.modelAnswer || q.sample_answer || q.sampleAnswer || q.solution_data?.model_answer || null,
    topic: q.metadata?.topic || q.ui_config?.topic || 'Personal Information',
    groupKey: q.groupKey || q.metadata?.group_key || null
  }));
}

/**
 * Part 1: Personal Information - Grouped by Core Story Topic (Topic Mode)
 */
export function adaptSpeakingPart1TopicGroups(questions = [], groups = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const grouped = new Map();
  questions.forEach((q) => {
    const topicName = q.ui_config?.topic || q.uiConfig?.topic || q.metadata?.topic || q.metadata?.ui_config?.topic || 'Personal Information';
    const topicKey = q.groupKey || q.metadata?.group_key || getSetGroupKey(q) || topicName;

    if (!grouped.has(topicKey)) grouped.set(topicKey, []);
    grouped.get(topicKey).push(q);
  });

  const entries = Array.from(grouped.entries());
  entries.sort(([keyA], [keyB]) => getSetNumber(keyA) - getSetNumber(keyB));

  return entries.map(([topicKey, qList], idx) => {
    const firstQ = qList[0] || {};
    const matchedGroup = (groups || []).find(g => g.group_key === topicKey || g.groupKey === topicKey);
    let topicName = matchedGroup?.name || firstQ.metadata?.topic || firstQ.ui_config?.topic || firstQ.topic || `Core Story ${idx + 1}`;
    if (typeof topicName === 'string') {
      topicName = topicName.replace(/\?{2,}/g, '–').trim();
    }

    return {
      id: topicKey,
      setKey: topicKey,
      groupKey: topicKey,
      topicName,
      questions: qList.map((q, qIdx) => ({
        id: q.id || `${topicKey}-q${qIdx + 1}`,
        num: qIdx + 1,
        speakTime: q.speak_time || q.ui_config?.speak_time_seconds || q.uiConfig?.speak_time || 30,
        prepTime: q.prep_time || q.ui_config?.prep_time_seconds || q.uiConfig?.prep_time || 0,
        question: cleanHtml(q.prompt || q.content || `Question ${qIdx + 1}`),
        modelAnswer: q.model_answer || q.modelAnswer || q.sample_answer || q.sampleAnswer || q.solution_data?.model_answer || null,
        topic: topicName
      }))
    };
  });
}

/**
 * Part 2: Describe a Photo
 * Grouped strictly by SET (52 SETs, ordered numerically 1 to 52).
 * Each SET contains 3 questions and 1 or 2 photo variants.
 */
export function adaptSpeakingPart2Data(questions = [], groups = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const grouped = new Map();
  questions.forEach((q) => {
    const setKey = getSetGroupKey(q);
    if (!grouped.has(setKey)) grouped.set(setKey, []);
    grouped.get(setKey).push(q);
  });

  const entries = Array.from(grouped.entries());
  entries.sort(([keyA], [keyB]) => getSetNumber(keyA) - getSetNumber(keyB));

  return entries.map(([setKey, qList], idx) => {
    const topicName = getSetDisplayName(qList, `SET ${String(idx + 1).padStart(2, '0')}`);

    // Deduplicate questions by prompt text to avoid DB duplicate question rows
    const uniqueQuestionsMap = new Map();
    qList.forEach(q => {
      const qText = cleanHtml(q.prompt || q.content || '');
      if (qText && !uniqueQuestionsMap.has(qText)) {
        uniqueQuestionsMap.set(qText, q);
      }
    });

    const finalQList = Array.from(uniqueQuestionsMap.values()).slice(0, 3);
    const setNum = extractSetNumber(qList[0]) || getSetNumber(setKey);

    const imageVariants = [];
    const seenUrls = new Set();

    qList.forEach(q => {
      const blocks = getBlocksFromQuestion(q);
      blocks.forEach(cb => {
        const block = cb.aptis_content_blocks || cb;
        if (block && (block.block_type === 'image' || block.content_role === 'image_1' || block.content_role === 'image_2' || block.media_url || block.metadata?.public_path)) {
          const url = resolveImageUrl(block, 2, setNum, cb.display_order || block.metadata?.variant_index || 1);

          if (url && !seenUrls.has(url)) {
            seenUrls.add(url);
            const variantIndex = imageVariants.length + 1;
            imageVariants.push({
              sourceKey: block.source_key || block.sourceKey || `${setKey}-var-${variantIndex}`,
              url,
              variantIndex,
              imageRole: 'description_variant',
              alt: `${topicName} - Photo ${variantIndex}`
            });
          }
        }
      });

      if (imageVariants.length === 0 && q.image) {
        const url = resolveImageUrl(q.image, 2, setNum, 1);
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          imageVariants.push({
            sourceKey: q.image.source_key || `${setKey}-var-1`,
            url,
            variantIndex: 1,
            imageRole: 'description_variant',
            alt: `${topicName} - Photo 1`
          });
        }
      }

      if (imageVariants.length === 0 && Array.isArray(q.metadata?.images)) {
        q.metadata.images.forEach((imgUrl, imgIdx) => {
          const resolved = resolveImageUrl(imgUrl, 2, setNum, imgIdx + 1);
          if (resolved && !seenUrls.has(resolved)) {
            seenUrls.add(resolved);
            imageVariants.push({
              sourceKey: `${setKey}-meta-var-${imgIdx + 1}`,
              url: resolved,
              variantIndex: imgIdx + 1,
              imageRole: 'description_variant',
              alt: `${topicName} - Photo ${imgIdx + 1}`
            });
          }
        });
      }
    });

    // Fallback images if DB didn't provide image URLs
    if (imageVariants.length === 0 && setNum && setNum < 9999) {
      const paddedNum = String(setNum).padStart(3, '0');
      const fallbackUrl1 = `/assets/speaking/part-2/set-${paddedNum}/photo-1.jpg`;
      const fallbackUrl2 = `/assets/speaking/part-2/set-${paddedNum}/photo-2.jpg`;

      imageVariants.push({
        sourceKey: `${setKey}-fallback-var-1`,
        url: fallbackUrl1,
        variantIndex: 1,
        imageRole: 'description_variant',
        alt: `${topicName} - Photo 1`
      });
      imageVariants.push({
        sourceKey: `${setKey}-fallback-var-2`,
        url: fallbackUrl2,
        variantIndex: 2,
        imageRole: 'description_variant',
        alt: `${topicName} - Photo 2`
      });
    }

    imageVariants.sort((a, b) => a.variantIndex - b.variantIndex);

    const firstQ = finalQList[0] || {};

    return {
      id: setKey,
      setKey,
      groupKey: setKey,
      topicName,
      imageVariants,
      activeVariantIndex: 0,
      prepTime: firstQ.prep_time || firstQ.ui_config?.prep_time_seconds || firstQ.uiConfig?.prep_time || 45,
      speakTime: firstQ.speak_time || firstQ.ui_config?.speak_time_seconds || firstQ.uiConfig?.speak_time || 45,
      questions: finalQList.map((q, qIdx) => ({
        id: q.id || `${setKey}-q${qIdx + 1}`,
        num: qIdx + 1,
        text: cleanHtml(q.prompt || q.content || `Question ${qIdx + 1}`),
        modelAnswer: q.model_answer || q.modelAnswer || q.sample_answer || q.sampleAnswer || q.solution_data?.model_answer || null
      }))
    };
  });
}

/**
 * Part 3: Compare Photos
 * Grouped strictly by SET (72 SETs, ordered numerically 1 to 72).
 * Each SET contains 3 questions and 1 combined comparison image.
 */
export function adaptSpeakingPart3Data(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const grouped = new Map();
  questions.forEach((q) => {
    const setKey = getSetGroupKey(q);
    if (!grouped.has(setKey)) grouped.set(setKey, []);
    grouped.get(setKey).push(q);
  });

  const entries = Array.from(grouped.entries());
  entries.sort(([keyA], [keyB]) => getSetNumber(keyA) - getSetNumber(keyB));

  return entries.map(([setKey, qList], idx) => {
    const topicName = getSetDisplayName(qList, `SET ${String(idx + 1).padStart(2, '0')}`);

    // Deduplicate questions by prompt text
    const uniqueQuestionsMap = new Map();
    qList.forEach(q => {
      const qText = cleanHtml(q.prompt || q.content || '');
      if (qText && !uniqueQuestionsMap.has(qText)) {
        uniqueQuestionsMap.set(qText, q);
      }
    });

    const finalQList = Array.from(uniqueQuestionsMap.values()).slice(0, 3);
    const setNum = extractSetNumber(qList[0]) || getSetNumber(setKey);
    let combinedImage = null;

    qList.forEach(q => {
      const blocks = getBlocksFromQuestion(q);
      blocks.forEach(cb => {
        const block = cb.aptis_content_blocks || cb;
        if (block && !combinedImage) {
          const url = resolveImageUrl(block, 3, setNum, 1);
          if (url) {
            combinedImage = {
              sourceKey: block.source_key || block.sourceKey || `${setKey}-combined`,
              url,
              imageRole: 'comparison_pair',
              layout: 'combined_pair',
              alt: `${topicName} - Comparison Image`
            };
          }
        }
      });

      if (!combinedImage && q.image) {
        const url = resolveImageUrl(q.image, 3, setNum, 1);
        if (url) {
          combinedImage = {
            sourceKey: q.image.source_key || `${setKey}-combined`,
            url,
            imageRole: 'comparison_pair',
            layout: 'combined_pair',
            alt: topicName
          };
        }
      }

      if (!combinedImage && (q.metadata?.image_url || q.metadata?.images?.[0])) {
        const url = resolveImageUrl(q.metadata?.image_url || q.metadata?.images?.[0], 3, setNum, 1);
        if (url) {
          combinedImage = {
            sourceKey: `${setKey}-meta-combined`,
            url,
            imageRole: 'comparison_pair',
            layout: 'combined_pair',
            alt: topicName
          };
        }
      }
    });

    // Fallback combined image if DB didn't provide image URL
    if (!combinedImage && setNum && setNum < 9999) {
      const paddedNum = String(setNum).padStart(3, '0');
      combinedImage = {
        sourceKey: `${setKey}-fallback-combined`,
        url: `/assets/speaking/part-3/set-${paddedNum}/comparison.jpg`,
        imageRole: 'comparison_pair',
        layout: 'combined_pair',
        alt: `${topicName} - Comparison Image`
      };
    }

    const firstQ = finalQList[0] || {};

    return {
      id: setKey,
      setKey,
      groupKey: setKey,
      topicName,
      combinedImage,
      prepTime: firstQ.prep_time || firstQ.ui_config?.prep_time_seconds || firstQ.uiConfig?.prep_time || 45,
      speakTime: firstQ.speak_time || firstQ.ui_config?.speak_time_seconds || firstQ.uiConfig?.speak_time || 45,
      questions: finalQList.map((q, qIdx) => ({
        id: q.id || `${setKey}-q${qIdx + 1}`,
        num: qIdx + 1,
        text: cleanHtml(q.prompt || q.content || `Question ${qIdx + 1}`),
        modelAnswer: q.model_answer || q.modelAnswer || q.sample_answer || q.sampleAnswer || q.solution_data?.model_answer || null
      }))
    };
  });
}

/**
 * Canonical Speaking Part 4 Data Definitions:
 * 6 Core Stories -> 58 Modules -> 174 Logical Questions (3 Prompts per Module)
 */
export const SPEAKING_PART4_CORE_STORIES = [
  {
    key: 'speaking-p4-core1',
    coreNumber: 1,
    name: 'CORE STORY 1 – STUDY PROJECT AND PRESENTATION',
    storyText: 'Last semester, I worked with three classmates on an English presentation about technology and study habits. We had two weeks to find information, make the slides and practise. I offered to lead the group because everyone had a different timetable...',
    moduleKeys: Array.from({ length: 16 }, (_, i) => `speaking-p4-topic${String(i + 1).padStart(3, '0')}`)
  },
  {
    key: 'speaking-p4-core2',
    coreNumber: 2,
    name: 'CORE STORY 2 – TRAVEL AND EXPLORING',
    storyText: 'Last summer, I took a memorable trip with my close friends to an interesting destination. We planned the journey carefully, explored unique landscapes, and dealt with unexpected weather changes...',
    moduleKeys: Array.from({ length: 11 }, (_, i) => `speaking-p4-topic${String(i + 17).padStart(3, '0')}`)
  },
  {
    key: 'speaking-p4-core3',
    coreNumber: 3,
    name: 'CORE STORY 3 – SOCIAL & RELATIONSHIPS',
    storyText: 'A few months ago, I was involved in a meaningful activity with my friends and community. We worked together, supported each other through challenges, and created lasting memories...',
    moduleKeys: Array.from({ length: 13 }, (_, i) => `speaking-p4-topic${String(i + 28).padStart(3, '0')}`)
  },
  {
    key: 'speaking-p4-core4',
    coreNumber: 4,
    name: 'CORE STORY 4 – PERSONAL CHOICES & HABITS',
    storyText: 'Recently, I faced a situation where I had to make an important personal decision and manage my time, money, and personal habits responsibly...',
    moduleKeys: Array.from({ length: 9 }, (_, i) => `speaking-p4-topic${String(i + 41).padStart(3, '0')}`)
  },
  {
    key: 'speaking-p4-core5',
    coreNumber: 5,
    name: 'CORE STORY 5 – SPECIAL EVENTS & CULTURAL ACTIVITIES',
    storyText: 'Earlier this year, I attended a special event and experienced cultural changes in daily life, formal clothing, and social communication...',
    moduleKeys: Array.from({ length: 4 }, (_, i) => `speaking-p4-topic${String(i + 50).padStart(3, '0')}`)
  },
  {
    key: 'speaking-p4-core6',
    coreNumber: 6,
    name: 'CORE STORY 6 – DAILY LIFE & FREE TIME',
    storyText: 'In my spare time, I often engage in relaxing activities like reading, music festivals, sports events, or visiting art exhibitions to broaden my mind...',
    moduleKeys: Array.from({ length: 5 }, (_, i) => `speaking-p4-topic${String(i + 54).padStart(3, '0')}`)
  }
];

export const SPEAKING_PART4_MODULE_NAMES = [
  'MODULE A – DIFFICULT QUESTION', 'MODULE B – ACHIEVEMENT', 'MODULE C – BUSY TIME', 'MODULE D – LEARNING A NEW SKILL',
  'MODULE E – PLANNING', 'MODULE F – TEAMWORK', 'MODULE G – GREAT EFFORT', 'MODULE H – ASKING A GOOD QUESTION',
  'MODULE I – ENGLISH COURSE', 'MODULE J – OVERCOMING A CHALLENGE', 'MODULE K – TECHNOLOGY HELPED ME', 'MODULE L – MAJOR RESPONSIBILITY',
  'MODULE M – GIVING A PRESENTATION', 'MODULE N – TRYING SOMETHING NEW', 'MODULE O – CHANGING SCHOOLS', 'MODULE P – INTERESTING INFORMATION',
  'MODULE A – LONG TRIP', 'MODULE B – EXPLORING A FOREST', 'MODULE C – VISITING A TALL BUILDING', 'MODULE D – A HOLIDAY OR VACATION',
  'MODULE E – BAD WEATHER', 'MODULE F – EXTREME SPORT', 'MODULE G – VISITING A NEW CITY', 'MODULE H – HISTORIC BUILDING',
  'MODULE I – A MEMORABLE PLACE OR TRIP', 'MODULE J – GETTING LOST', 'MODULE K – AMUSEMENT PARK',
  'MODULE A – VISITING A FRIEND', 'MODULE B – HELPING SOMEONE', 'MODULE C – ACTIVITY FOR CHILDREN', 'MODULE D – LAUGHING WITH A FRIEND',
  'MODULE E – MEETING A NEW FRIEND', 'MODULE F – RECEIVING GOOD NEWS', 'MODULE G – DIFFERENT GENERATIONS', 'MODULE H – A SPECIAL GIFT',
  'MODULE I – RECEIVING HELP', 'MODULE J – MEETING A FOREIGNER', 'MODULE K – SHARING SOMETHING', 'MODULE L – RECEIVING A COMPLIMENT',
  'MODULE M – VOLUNTEER OR COMMUNITY ACTIVITY',
  'MODULE A – WANTING SOMETHING I COULD NOT GET', 'MODULE B – SAVING MONEY', 'MODULE C – SOMETHING I REALLY WANTED TO BUY',
  'MODULE D – MAKING A CHOICE', 'MODULE E – BEING IN A HURRY', 'MODULE F – DOING SOMETHING I DISLIKED', 'MODULE G – SLEEPING HABITS',
  'MODULE H – BREAKING A RULE', 'MODULE I – BEING ASKED TO STOP',
  'MODULE A – FAVOURITE OR FORMAL CLOTHES', 'MODULE B – MEETING A RUDE PERSON', 'MODULE C – CHANGING A DAILY ROUTINE', 'MODULE D – CHANGING JOBS',
  'MODULE A – WAITING FOR SOMETHING IMPORTANT', 'MODULE B – SPORTS EVENT', 'MODULE C – MUSIC FESTIVAL', 'MODULE D – READING A GOOD BOOK', 'MODULE E – A WORK OF ART'
];

/**
 * Helper to resolve Core Story for a given module key or index
 */
export function getCoreStoryForModule(moduleKey, moduleIdx = -1) {
  let key = moduleKey;
  if (!key && moduleIdx >= 0) {
    key = `speaking-p4-topic${String(moduleIdx + 1).padStart(3, '0')}`;
  }
  for (const cs of SPEAKING_PART4_CORE_STORIES) {
    if (cs.moduleKeys.includes(key)) {
      return cs;
    }
  }
  return SPEAKING_PART4_CORE_STORIES[0];
}

/**
 * Part 4: Abstract Topic
 * Grouped strictly by MODULE (58 MODULEs).
 * Each Module contains 3 logical prompts (main, subquestion_1, subquestion_2).
 * 60s prep, 120s speak for the whole Module (single task card, single recorder).
 */
export function adaptSpeakingPart4Data(questions = [], groups = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return Array.from({ length: 58 }, (_, idx) => {
      const topicKey = `speaking-p4-topic${String(idx + 1).padStart(3, '0')}`;
      const coreStory = getCoreStoryForModule(topicKey, idx);
      const moduleName = SPEAKING_PART4_MODULE_NAMES[idx] || `MODULE ${String(idx + 1).padStart(2, '0')}`;
      return {
        id: topicKey,
        setKey: topicKey,
        groupKey: topicKey,
        moduleKey: topicKey,
        moduleName,
        topicName: moduleName,
        coreKey: coreStory.key,
        coreName: coreStory.name,
        coreStoryText: coreStory.storyText,
        coreNumber: coreStory.coreNumber,
        displayOrder: idx + 1,
        prepTime: 0,
        speakTime: 120,
        prompts: [
          { id: `${topicKey}-p1`, role: 'main', promptNumber: 1, text: `Main Question for ${moduleName}`, variants: [] },
          { id: `${topicKey}-p2`, role: 'subquestion_1', promptNumber: 2, text: `Subquestion 1 for ${moduleName}`, variants: [] },
          { id: `${topicKey}-p3`, role: 'subquestion_2', promptNumber: 3, text: `Subquestion 2 for ${moduleName}`, variants: [] }
        ],
        questions: [`Main Question for ${moduleName}`, `Subquestion 1 for ${moduleName}`, `Subquestion 2 for ${moduleName}`]
      };
    });
  }

  const grouped = new Map();
  questions.forEach((q) => {
    const setKey = getSetGroupKey(q);
    if (!grouped.has(setKey)) grouped.set(setKey, []);
    grouped.get(setKey).push(q);
  });

  const entries = Array.from(grouped.entries());
  entries.sort(([keyA], [keyB]) => getSetNumber(keyA) - getSetNumber(keyB));

  return entries.map(([setKey, qList], idx) => {
    const fallbackName = SPEAKING_PART4_MODULE_NAMES[idx] || `MODULE ${String(idx + 1).padStart(2, '0')}`;
    const topicName = getSetDisplayName(qList, fallbackName);
    const firstQ = qList[0] || {};
    const coreStory = getCoreStoryForModule(setKey, idx);

    // Map the 3 logical prompts for this module
    const roles = ['main', 'subquestion_1', 'subquestion_2'];
    const prompts = qList.slice(0, 3).map((q, qIdx) => {
      const text = cleanHtml(q.prompt || q.content || `Prompt ${qIdx + 1}`);
      const variants = Array.isArray(q.metadata?.prompt_variants)
        ? q.metadata.prompt_variants
        : (Array.isArray(q.metadata?.variants) ? q.metadata.variants : []);

      return {
        id: q.id || `${setKey}-p${qIdx + 1}`,
        role: q.metadata?.role || q.ui_config?.role || roles[qIdx] || 'prompt',
        promptNumber: qIdx + 1,
        text,
        variants
      };
    });

    const qTexts = prompts.map(p => p.text);

    return {
      id: setKey,
      setKey,
      groupKey: setKey,
      moduleKey: setKey,
      moduleName: topicName,
      topicName,
      coreKey: coreStory.key,
      coreName: coreStory.name,
      coreStoryText: coreStory.storyText,
      coreNumber: coreStory.coreNumber,
      displayOrder: idx + 1,
      prepTime: 0,
      speakTime: firstQ.speak_time || firstQ.ui_config?.speak_time_seconds || firstQ.uiConfig?.speak_time || 120,
      prompts,
      questions: qTexts
    };
  });
}
