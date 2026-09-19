import { assignVoiceProfile } from '../services/listeningAudioProvider.js';
import { normalizeCorrectAnswer } from '../services/aptisService.js';

/**
 * Helper to strip HTML tags and decode clean text
 */
function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract audio media URL, title, content from formatted question payload
 */
function cleanTranscript(str) {
  if (!str) return null;
  const cleaned = cleanHtml(str);
  if (!cleaned || /^Audio recording for/i.test(cleaned) || /^Audio for/i.test(cleaned) || /^Listening recording for/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function extractAudioInfo(q) {
  const audioBlock = q.audio || (q.content_blocks && q.content_blocks.find(b => b.block_type === 'audio')) || null;
  
  const rawTranscript = 
    q.transcript || 
    audioBlock?.content || 
    audioBlock?.metadata?.transcript || 
    audioBlock?.metadata?.dialogue || 
    q.metadata?.transcript || 
    q.metadata?.audio_text || 
    q.metadata?.script || 
    null;

  const validTranscript = cleanTranscript(rawTranscript);

  return {
    mediaUrl: audioBlock?.media_url || null,
    title: audioBlock?.title || null,
    transcript: validTranscript,
    audioBlockKey: audioBlock?.id || q.source_key || 'audio-key'
  };
}

/**
 * 1. Part 1 Adapter: Multiple Choice Short Conversations / Announcements
 * 286 questions, each question has individual audio binding
 */
export function adaptListeningPart1Data(questions = []) {
  if (!Array.isArray(questions)) return [];

  return questions.map((q, idx) => {
    const options = (q.options || [])
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map(opt => ({
        key: opt.option_key || String.fromCharCode(65 + (opt.display_order || 1) - 1),
        text: cleanHtml(opt.content)
      }));

    let correctAnswer = normalizeCorrectAnswer(q.correct_answer) ||
                        normalizeCorrectAnswer(q.correctAnswer) ||
                        normalizeCorrectAnswer(q.metadata?.correct_option) ||
                        normalizeCorrectAnswer(q.metadata?.correct_answer) ||
                        normalizeCorrectAnswer(q.metadata?.answer);

    if (!correctAnswer && Array.isArray(q.options)) {
      const correctOpt = q.options.find(o => o.is_correct || o.metadata?.is_correct);
      if (correctOpt) {
        correctAnswer = correctOpt.option_key || String.fromCharCode(65 + (correctOpt.display_order || 1) - 1);
      }
    }

    if (!correctAnswer && options.length > 0) {
      correctAnswer = options[0].key;
    }

    const audioInfo = extractAudioInfo(q);
    const requestedVoiceProfile = assignVoiceProfile(q.source_key || `lis-p1-${idx + 1}`);

    const questionText = cleanHtml(q.content);
    const optionsLine = options.map(o => `${o.key}. ${o.text}`).join('\n');
    const fallbackTranscript = `${questionText}\n\nOptions:\n${optionsLine}`;

    const optionsSpoken = options.map(o => `${o.key}: ${o.text}`).join('. ');
    const fallbackAudioContent = `Question: ${questionText}. Options are: ${optionsSpoken}`;
    const finalAudioContent = audioInfo.transcript 
      ? `${questionText}\n${audioInfo.transcript}` 
      : fallbackAudioContent;

    return {
      id: q.id,
      part: 1,
      questionNumber: idx + 1,
      sourceKey: q.source_key,
      title: `Question ${idx + 1}`,
      topic: q.metadata?.topic || q.metadata?.source_section || "Short Conversation",
      question: questionText,
      options,
      correctAnswer,
      explanation: q.explanation || q.metadata?.explanation || null,
      audioUrl: audioInfo.mediaUrl,
      audioContent: finalAudioContent,
      transcript: audioInfo.transcript || fallbackTranscript,
      requestedVoiceProfile,
      displayOrder: q.display_order || idx + 1
    };
  });
}

function cleanTopicTitle(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^Listening\s+Part\s+\d+:?\s*/i, '');
  str = str.replace(/^Listening\s+Practice\s+Set\s*\([^)]*\):?\s*/i, '');
  return str.trim();
}

function shuffleOptions(options = [], seedStr = '') {
  if (!Array.isArray(options) || options.length <= 1) return options;
  const list = [...options];
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  for (let i = list.length - 1; i > 0; i--) {
    hash = Math.sin(hash + i) * 10000;
    const j = Math.floor((hash - Math.floor(hash)) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * 2. Part 2 Adapter: Information Matching
 * 176 questions, 44 sets x 4 questions. 1 set audio block per set.
 */
export function adaptListeningPart2Data(questions = [], groupOrGroups = null) {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  const groupsList = Array.isArray(groupOrGroups) ? groupOrGroups : (groupOrGroups ? [groupOrGroups] : []);

  const setGroupsMap = new Map();

  questions.forEach((q) => {
    const rawSetKey = q.metadata?.group_key || (q.source_key ? q.source_key.replace(/-q\d+$/i, '') : '') || 'default-set';
    const normalizedKey = rawSetKey.replace(/^lis-/i, 'listening-');
    if (!setGroupsMap.has(normalizedKey)) {
      setGroupsMap.set(normalizedKey, []);
    }
    setGroupsMap.get(normalizedKey).push(q);
  });

  const sets = [];
  let setIdx = 0;

  for (const [setKey, chunkQuestions] of setGroupsMap.entries()) {
    setIdx++;
    const firstQ = chunkQuestions[0];
    const audioInfo = extractAudioInfo(firstQ);

    let options = (firstQ?.options || []).map((opt, i) => {
      let label = cleanHtml(opt.content).replace(/^[A-Z]\.\s*/i, '').trim();
      const optKey = opt.option_key || String.fromCharCode(65 + i);

      if (
        (setKey.includes('set001') || (firstQ?.metadata?.topic || '').includes('Protect the environment 1')) &&
        optKey === 'B' &&
        /commercial cleaning/i.test(label)
      ) {
        label = 'Donates or gives away old belongings';
      }

      return {
        key: optKey,
        label
      };
    });

    options = shuffleOptions(options, setKey);

    const items = chunkQuestions.map((q, itemIdx) => {
      const personLabel = `Person ${String.fromCharCode(65 + itemIdx)}`;
      let itemMatch = normalizeCorrectAnswer(q.correct_answer) ||
                      normalizeCorrectAnswer(q.correctAnswer) ||
                      normalizeCorrectAnswer(q.metadata?.match) ||
                      normalizeCorrectAnswer(q.metadata?.correct_option) ||
                      normalizeCorrectAnswer(q.metadata?.answer) ||
                      options[itemIdx % options.length]?.key ||
                      String.fromCharCode(65 + itemIdx);

      return {
        id: q.id,
        questionNumber: itemIdx + 1,
        sourceKey: q.source_key,
        speaker: personLabel,
        prompt: personLabel,
        correctAnswer: itemMatch,
        explanation: q.explanation || q.metadata?.explanation || null
      };
    });

    const requestedVoiceProfile = assignVoiceProfile(setKey);

    const speakersSpoken = items.map((it, i) => {
      const q = chunkQuestions[i];
      const qText = cleanHtml(q?.content);
      const isGeneric = !qText || /^What does Person/i.test(qText);
      return `${it.speaker}${isGeneric ? '' : `: ${qText}`}`;
    }).join('. ');

    const matchingGroup = groupsList.find(g => 
      g.group_key === setKey || 
      g.group_key === setKey.replace(/^listening-/i, 'lis-') ||
      g.id === firstQ?.metadata?.group_id
    ) || groupsList[setIdx - 1];

    const rawTitle = matchingGroup?.name || firstQ?.metadata?.topic || firstQ?.metadata?.source_section || firstQ?.group_name || `Set ${setIdx}: Information Matching`;
    const topicTitle = cleanTopicTitle(rawTitle) || `Set ${setIdx}: Information Matching`;
    const fallbackAudioText = `Information Matching set: ${topicTitle}. Speakers: ${speakersSpoken}`;
    const finalAudioContent = audioInfo.transcript || fallbackAudioText;

    const transcriptLines = items.map((it, i) => {
      const q = chunkQuestions[i];
      const qText = cleanHtml(q?.content);
      return `${it.speaker}: ${qText || 'Preference description'}`;
    }).join('\n');
    const fallbackTranscript = `${topicTitle}\n\n${transcriptLines}`;

    sets.push({
      id: `lis-p2-set-${setIdx}`,
      setNumber: setIdx,
      setKey,
      part: 2,
      eyebrow: "LISTENING – PART 2",
      title: topicTitle,
      topic: topicTitle,
      description: "Listen to 4 speakers describing their preferences. Match Person A, Person B, Person C, Person D with the options below.",
      audioUrl: audioInfo.mediaUrl,
      audioContent: finalAudioContent,
      transcript: audioInfo.transcript || fallbackTranscript,
      requestedVoiceProfile,
      options,
      items
    });
  }

  return sets;
}

/**
 * 3. Part 3 Adapter: Opinion Matching
 * 176 questions, 44 sets x 4 questions. 1 discussion audio block per set.
 */
export function adaptListeningPart3Data(questions = [], groupOrGroups = null) {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  const groupsList = Array.isArray(groupOrGroups) ? groupOrGroups : (groupOrGroups ? [groupOrGroups] : []);

  const setGroupsMap = new Map();

  questions.forEach((q) => {
    const rawSetKey = q.metadata?.group_key || (q.source_key ? q.source_key.replace(/-q\d+$/i, '') : '') || 'default-set';
    const normalizedKey = rawSetKey.replace(/^lis-/i, 'listening-');
    if (!setGroupsMap.has(normalizedKey)) {
      setGroupsMap.set(normalizedKey, []);
    }
    setGroupsMap.get(normalizedKey).push(q);
  });

  const sets = [];
  let setIdx = 0;

  for (const [setKey, chunkQuestions] of setGroupsMap.entries()) {
    setIdx++;
    const firstQ = chunkQuestions[0];
    const audioInfo = extractAudioInfo(firstQ);

    let options = (firstQ?.options || []).map(opt => ({
      key: opt.option_key || opt.content.toLowerCase(),
      label: cleanHtml(opt.content)
    }));

    if (options.length === 0) {
      options = [
        { key: 'man', label: 'Man' },
        { key: 'woman', label: 'Woman' },
        { key: 'both', label: 'Both' }
      ];
    }

    const statements = chunkQuestions.map((q, sIdx) => {
      let stAnswer = normalizeCorrectAnswer(q.correct_answer) ||
                     normalizeCorrectAnswer(q.correctAnswer) ||
                     normalizeCorrectAnswer(q.metadata?.answer) ||
                     normalizeCorrectAnswer(q.metadata?.correct_option) ||
                     options[sIdx % options.length]?.key ||
                     'man';

      return {
        id: q.id,
        questionNumber: sIdx + 1,
        sourceKey: q.source_key,
        text: cleanHtml(q.content),
        correctAnswer: stAnswer,
        explanation: q.explanation || q.metadata?.explanation || null
      };
    });

    const manVoiceProfile = assignVoiceProfile(setKey, { speaker: 'man' });
    const womanVoiceProfile = assignVoiceProfile(setKey, { speaker: 'woman' });

    const matchingGroup = groupsList.find(g => 
      g.group_key === setKey || 
      g.group_key === setKey.replace(/^listening-/i, 'lis-') ||
      g.id === firstQ?.metadata?.group_id
    ) || groupsList[setIdx - 1];

    const rawTitle = matchingGroup?.name || firstQ?.metadata?.topic || firstQ?.metadata?.source_section || firstQ?.group_name || `Opinion Matching Set ${setIdx}`;
    const topicTitle = cleanTopicTitle(rawTitle) || `Opinion Matching Set ${setIdx}`;
    const fallbackAudioText = `Discussion on ${topicTitle}. Statements to evaluate: ${statements.map(s => `${s.questionNumber}: ${s.text}`).join('. ')}`;
    const finalAudioContent = audioInfo.transcript || fallbackAudioText;

    const statementsFormatted = statements.map(s => `${s.questionNumber}. ${s.text}`).join('\n');
    const fallbackTranscript = `Discussion Topic: ${topicTitle}\n\nStatements:\n${statementsFormatted}`;

    sets.push({
      id: `lis-p3-set-${setIdx}`,
      setNumber: setIdx,
      setKey,
      totalSets: setGroupsMap.size,
      part: 3,
      eyebrow: "PART 3 – OPINION MATCHING",
      topic: topicTitle,
      title: topicTitle,
      description: "Read the statements below. Listen to the conversation and decide who holds each opinion.",
      audioUrl: audioInfo.mediaUrl,
      audioContent: finalAudioContent,
      transcript: audioInfo.transcript || fallbackTranscript,
      manVoiceProfile,
      womanVoiceProfile,
      requestedVoiceProfile: manVoiceProfile,
      options,
      statements
    });
  }

  return sets;
}

/**
 * 4. Part 4 Adapter: Longer Monologues
 * 120 questions, 60 sets x 2 questions. 1 monologue audio block per set.
 */
export function adaptListeningPart4Data(questions = [], groupOrGroups = null) {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  const groupsList = Array.isArray(groupOrGroups) ? groupOrGroups : (groupOrGroups ? [groupOrGroups] : []);

  const setGroupsMap = new Map();

  questions.forEach((q) => {
    const rawSetKey = q.metadata?.group_key || (q.source_key ? q.source_key.replace(/-q\d+$/i, '') : '') || 'default-set';
    const normalizedKey = rawSetKey.replace(/^lis-/i, 'listening-');
    if (!setGroupsMap.has(normalizedKey)) {
      setGroupsMap.set(normalizedKey, []);
    }
    setGroupsMap.get(normalizedKey).push(q);
  });

  const topicGroupsMap = new Map();
  let setIdx = 0;

  for (const [setKey, chunkQuestions] of setGroupsMap.entries()) {
    setIdx++;
    const firstQ = chunkQuestions[0];
    const audioInfo = extractAudioInfo(firstQ);

    const matchingGroup = groupsList.find(g => 
      g.group_key === setKey || 
      g.group_key === setKey.replace(/^listening-/i, 'lis-') ||
      g.id === firstQ?.metadata?.group_id
    ) || groupsList[setIdx - 1];

    const rawTitle = matchingGroup?.name || firstQ?.metadata?.topic || firstQ?.metadata?.source_section || firstQ?.group_name || "EDUCATION & LEARNING";
    const topicName = cleanTopicTitle(rawTitle) || "EDUCATION & LEARNING";
    const topicId = topicName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!topicGroupsMap.has(topicId)) {
      topicGroupsMap.set(topicId, {
        topicId,
        topicName,
        sets: []
      });
    }

    const setQuestions = chunkQuestions.map((q, qIdx) => {
      const options = (q.options || [])
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(opt => ({
          key: opt.option_key || String.fromCharCode(65 + (opt.display_order || 1) - 1),
          text: cleanHtml(opt.content)
        }));

      let correctAnswer = normalizeCorrectAnswer(q.correct_answer) ||
                          normalizeCorrectAnswer(q.correctAnswer) ||
                          normalizeCorrectAnswer(q.metadata?.correct_option) ||
                          normalizeCorrectAnswer(q.metadata?.correct_answer) ||
                          normalizeCorrectAnswer(q.metadata?.answer);

      if (!correctAnswer && Array.isArray(q.options)) {
        const correctOpt = q.options.find(o => o.is_correct || o.metadata?.is_correct);
        if (correctOpt) {
          correctAnswer = correctOpt.option_key || String.fromCharCode(65 + (correctOpt.display_order || 1) - 1);
        }
      }

      if (!correctAnswer && options.length > 0) {
        correctAnswer = options[0].key;
      }

      return {
        id: q.id,
        questionNumber: qIdx + 1,
        sourceKey: q.source_key,
        question: cleanHtml(q.content),
        options,
        correctAnswer,
        explanation: q.explanation || q.metadata?.explanation || null
      };
    });

    const requestedVoiceProfile = assignVoiceProfile(setKey);

    const monologueAudioText = `Monologue on ${firstQ?.metadata?.title || topicName}. Questions: ${setQuestions.map(q => q.question).join('. ')}`;
    const finalAudioContent = audioInfo.transcript || monologueAudioText;

    const questionsFormatted = setQuestions.map(q => `${q.questionNumber}. ${q.question}`).join('\n');
    const fallbackTranscript = `Monologue Topic: ${firstQ?.metadata?.title || topicName}\n\nQuestions:\n${questionsFormatted}`;

    topicGroupsMap.get(topicId).sets.push({
      id: `lis-p4-set-${setIdx}`,
      setNumber: setIdx,
      setKey,
      part: 4,
      type: "Monologue",
      questionRange: `Questions 1–${setQuestions.length}`,
      topicName,
      title: firstQ?.metadata?.title || topicName,
      audioUrl: audioInfo.mediaUrl,
      audioContent: finalAudioContent,
      transcript: audioInfo.transcript || fallbackTranscript,
      requestedVoiceProfile,
      questions: setQuestions
    });
  }

  return Array.from(topicGroupsMap.values());
}
