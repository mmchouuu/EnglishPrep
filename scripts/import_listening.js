import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Baseline configuration for strict equality validation on import
const BASELINE = {
  p1Questions: 286,
  p1Sets: 22,
  p1QuestionsPerSet: 13,
  p1TopicGroups: 8,
  p2Questions: 176,
  p2Sets: 44,
  p2QuestionsPerSet: 4,
  p3Questions: 176,
  p3Sets: 44,
  p3QuestionsPerSet: 4,
  p4Questions: 120,
  p4Sets: 60,
  p4QuestionsPerSet: 2,
  totalQuestions: 758,
  totalSets: 170,
  totalAudioBlocks: 434,
  totalWordComments: 565,
  audioWithTranscript: 433,
  audioMissingTranscript: 1
};

// Part 1 Topic Group Metadata Registry
const PART1_TOPIC_GROUPS = {
  time_date_duration: { name: 'Time, Date & Duration', description: 'Listening Part 1 Topic: Time, Date & Duration' },
  numbers_money_codes: { name: 'Numbers, Money & Codes', description: 'Listening Part 1 Topic: Numbers, Money & Codes' },
  places_directions: { name: 'Places & Directions', description: 'Listening Part 1 Topic: Places & Directions' },
  travel_transport_mode: { name: 'Travel & Transport', description: 'Listening Part 1 Topic: Travel & Transport' },
  people_relationships: { name: 'People & Relationships', description: 'Listening Part 1 Topic: People & Relationships' },
  reasons_opinions_purpose: { name: 'Reasons, Opinions & Purpose', description: 'Listening Part 1 Topic: Reasons, Opinions & Purpose' },
  objects_descriptions: { name: 'Objects & Descriptions', description: 'Listening Part 1 Topic: Objects & Descriptions' },
  activities_events_details: { name: 'Activities & Events', description: 'Listening Part 1 Topic: Activities & Events' }
};

// Candidate source paths
const CANDIDATE_SOURCE_PATHS = [
  path.join(projectRoot, 'docs', '03-listening-inline-transcripts.md'),
  path.join(projectRoot, 'docs', 'aptis', '03-listening.md'),
  path.join(projectRoot, 'docs', '03-listening.md')
];

let SOURCE_FILE_ABS = null;
let SOURCE_FILE_REL = null;

for (const candPath of CANDIDATE_SOURCE_PATHS) {
  if (fs.existsSync(candPath)) {
    SOURCE_FILE_ABS = candPath;
    SOURCE_FILE_REL = path.relative(projectRoot, candPath).replace(/\\/g, '/');
    break;
  }
}

if (!SOURCE_FILE_ABS) {
  throw new Error(`[Phase 3B Error] Listening source file not found in candidate paths: ${CANDIDATE_SOURCE_PATHS.join(', ')}`);
}

const MANIFEST_DIR = path.join(projectRoot, 'docs', 'aptis', 'manifests');
const MANIFEST_FILE = path.join(MANIFEST_DIR, 'listening.json');
const SEED_FILE = path.join(projectRoot, 'supabase', 'seed_listening.sql');
const REPORT_FILE = path.join(projectRoot, 'docs', 'aptis', 'phase3-listening-report.md');

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sortedKeys = Object.keys(obj).sort();
  const res = {};
  for (const key of sortedKeys) {
    res[key] = canonicalize(obj[key]);
  }
  return res;
}

/**
 * Canonical Hash for Audio Block based strictly on content data
 */
function computeAudioBlockHash(audioData) {
  const obj = canonicalize({
    content: audioData.content || '',
    metadata: {
      part_number: audioData.partNumber,
      speaker_labels: audioData.speakerLabels || [],
      transcript: audioData.transcript || null,
      transcript_status: audioData.transcriptStatus || 'missing_source_comment',
      word_comment_ids: audioData.wordCommentIds || []
    },
    skill: 'listening',
    title: audioData.title || ''
  });
  return crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
}

/**
 * Computes canonical hash for a question strictly based on content data.
 * MUST NOT contain: question's own source_key, UUID, run_id, timestamp, or absolute paths.
 */
function computeCanonicalHash(q) {
  const rawObj = {
    content: q.content,
    correct_answer: q.correctAnswer,
    metadata: q.metadata || {},
    options: (q.options || []).map(o => ({
      content: o.content,
      display_order: o.displayOrder,
      option_key: o.optionKey
    })).sort((a, b) => a.display_order - b.display_order),
    part_number: q.partNumber,
    question_type: q.questionType,
    skill: 'listening',
    ui_config: q.uiConfig || {}
  };

  if (q.contentBlock) {
    rawObj.content_block = {
      source_key: q.contentBlock.sourceKey,
      content_hash: q.contentBlock.contentHash
    };
  }

  const canonicalObj = canonicalize(rawObj);
  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj), 'utf8').digest('hex');
}

/**
 * Extract speaker labels from transcript content
 */
function extractSpeakerLabels(transcriptText, defaultLabels = []) {
  if (!transcriptText) return defaultLabels;
  const speakers = new Set();
  const lines = transcriptText.split('\n');
  for (const line of lines) {
    const clean = line.replace(/^\>\s*/, '').trim();
    const m = clean.match(/^(Person [A-D]|[A-Z][a-zA-Z0-9\s_]{0,15}):/);
    if (m) {
      const spk = m[1].trim();
      if (!spk.startsWith('Segment')) {
        speakers.add(spk);
      }
    }
  }
  if (speakers.size > 0) return Array.from(speakers);
  return defaultLabels;
}

/**
 * Clean transcript content from raw html details tag block
 */
function cleanTranscriptContent(rawDetailsBlock) {
  if (!rawDetailsBlock) return null;
  let content = rawDetailsBlock.replace(/<summary>[\s\S]*?<\/summary>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  content = content.split(/\r?\n/).map(line => line.replace(/^>\s?/, '').trimRight()).join('\n');
  content = content.trim();
  return content.length > 0 ? content : null;
}

/**
 * Parser for Inline Transcripts Listening File
 */
function parseListeningSkill(fileContent) {
  const rawLines = fileContent.split(/\r?\n/);

  // 1. Dynamic Heading Detection for all 4 Headings
  let p1Line = -1;
  let p2Line = -1;
  let p3Line = -1;
  let p4Line = -1;

  for (let i = 0; i < rawLines.length; i++) {
    const cleanLine = rawLines[i].replace(/<!--[\s\S]*?-->/g, '').replace(/[\*\_#]/g, '').trim();

    if (p1Line === -1 && /Part\s*1\b/i.test(cleanLine)) {
      p1Line = i;
    } else if (p2Line === -1 && /Part\s*2\b/i.test(cleanLine)) {
      p2Line = i;
    } else if (p3Line === -1 && /Part\s*3\b/i.test(cleanLine)) {
      p3Line = i;
    } else if (p4Line === -1 && /Part\s*4\b/i.test(cleanLine)) {
      p4Line = i;
    }
  }

  if (p1Line < 0 || p2Line <= p1Line || p3Line <= p2Line || p4Line <= p3Line) {
    throw new Error(`[Heading Order Error] Dynamic heading resolution failed or invalid order: p1=${p1Line}, p2=${p2Line}, p3=${p3Line}, p4=${p4Line}`);
  }

  const p1RawLines = rawLines.slice(p1Line + 1, p2Line);
  const p2RawLines = rawLines.slice(p2Line + 1, p3Line);
  const p3RawLines = rawLines.slice(p3Line + 1, p4Line);
  const p4RawLines = rawLines.slice(p4Line + 1);

  // Storage for unique content blocks
  const contentBlocksMap = new Map();

  function storeAudioBlock(audioData) {
    const blockHash = computeAudioBlockHash(audioData);
    const audioBlock = {
      skill: 'listening',
      partNumber: audioData.partNumber,
      blockType: 'audio',
      sourceKey: audioData.sourceKey,
      title: audioData.title,
      content: audioData.content || `Audio recording for ${audioData.title}`,
      metadata: {
        source_key: audioData.sourceKey,
        skill: 'listening',
        part_number: audioData.partNumber,
        transcript: audioData.transcript,
        transcript_status: audioData.transcriptStatus,
        word_comment_ids: audioData.wordCommentIds || [],
        speaker_labels: audioData.speakerLabels || [],
        status: 'missing_audio',
        audio_url: null,
        audio_path: null,
        mime_type: 'audio/mpeg'
      },
      contentHash: blockHash
    };
    contentBlocksMap.set(audioData.sourceKey, audioBlock);
    return audioBlock;
  }

  // =========================================================================
  // PARSE PART 1 (p1RawLines) — 286 Questions, 286 Audio Blocks
  // =========================================================================
  const p1Questions = [];
  const p1Text = p1RawLines.join('\n');
  const p1Blocks = p1Text.split(/(?=<!--\s*source_key:\s*listening-p1-)/g);

  let p1GlobalCount = 0;
  for (const blockStr of p1Blocks) {
    if (!blockStr.trim() || !blockStr.includes('<!-- source_key: listening-p1-')) continue;

    const sourceKeyMatch = blockStr.match(/<!--\s*source_key:\s*(listening-p1-set\d+-q\d+)\s*-->/);
    if (!sourceKeyMatch) continue;

    p1GlobalCount++;
    const sourceKey = sourceKeyMatch[1];
    const setNum = Math.ceil(p1GlobalCount / 13);
    const formattedSet = String(setNum).padStart(3, '0');
    const groupKey = `listening-p1-set${formattedSet}`;
    const groupName = `Listening Part 1 Set ${formattedSet}`;

    // Extract listening_metadata
    let metadataObj = {};
    const metaMatch = blockStr.match(/<!--\s*listening_metadata:\s*(\{.*?\})\s*-->/);
    if (metaMatch) {
      try {
        metadataObj = JSON.parse(metaMatch[1]);
      } catch (e) {}
    }

    const infoType = metadataObj.information_type || 'activities_events_details';
    const classificationStatus = metadataObj.classification_status || 'reviewed';

    // Extract audio block details
    const audioKeyMatch = blockStr.match(/<!--\s*audio_source_key:\s*(listening-p1-set\d+-q\d+-audio)\s*-->/);
    const audioSourceKey = audioKeyMatch ? audioKeyMatch[1] : `${sourceKey}-audio`;

    const statusMatch = blockStr.match(/<!--\s*transcript_status:\s*(\w+)\s*-->/);
    const transcriptStatus = statusMatch ? statusMatch[1] : 'source_word_comment';

    const commentsMatch = blockStr.match(/<!--\s*word_comment_ids:\s*([\d,]+)\s*-->/);
    const wordCommentIds = commentsMatch ? commentsMatch[1].split(',').map(s => s.trim()) : (metadataObj.word_comment_id ? [String(metadataObj.word_comment_id)] : []);

    const detailsMatch = blockStr.match(/<details class="audio-transcript">([\s\S]*?)<\/details>/i);
    const rawDetails = detailsMatch ? detailsMatch[1] : '';
    const transcriptText = cleanTranscriptContent(rawDetails);
    const speakerLabels = extractSpeakerLabels(transcriptText, ['Man', 'Woman']);

    const audioBlock = storeAudioBlock({
      sourceKey: audioSourceKey,
      partNumber: 1,
      title: `Part 1 Question ${p1GlobalCount} Audio`,
      content: transcriptText,
      transcript: transcriptText,
      transcriptStatus: transcriptStatus,
      wordCommentIds: wordCommentIds,
      speakerLabels: speakerLabels
    });

    // Parse question text & options
    const qMatch = blockStr.match(/>\s*\*\*(\d+)\.\s*(.*?)\*\*/);
    const questionText = qMatch ? qMatch[2].replace(/\\_/g, '_').trim() : '';

    const options = [];
    let underlinedKey = null;

    const optRegex = />\s*(<u>)?\s*([A-D])\.\s*(.*?)(<\/u>)?$/gm;
    let match;
    while ((match = optRegex.exec(blockStr)) !== null) {
      const isUnderlined = Boolean(match[1] || match[4] || match[0].includes('<u>'));
      const optKey = match[2].toUpperCase();
      const optContent = match[3].replace(/<\/?[^>]+(>|$)/g, '').trim();

      if (isUnderlined) underlinedKey = optKey;

      options.push({
        optionKey: optKey,
        content: optContent,
        displayOrder: options.length + 1,
        isUnderlined: isUnderlined
      });
    }

    if (options.length === 0 || !underlinedKey) {
      throw new Error(`[Parse Error] Part 1 Question ${sourceKey} options or correct answer missing.`);
    }

    p1Questions.push({
      skill: 'listening',
      partNumber: 1,
      questionType: 'multiple_choice',
      questionNumber: ((p1GlobalCount - 1) % 13) + 1,
      globalIndex: p1GlobalCount,
      sourceKey: sourceKey,
      groupKey: groupKey,
      groupName: groupName,
      content: questionText,
      options: options,
      correctAnswer: { correct_option: underlinedKey },
      contentBlock: audioBlock,
      solutionData: {
        transcript: transcriptText,
        transcript_status: transcriptStatus,
        word_comment_ids: wordCommentIds,
        speaker_labels: speakerLabels
      },
      metadata: {
        source_section: 'part_1',
        task_type: 'information_recognition',
        information_type: infoType,
        classification_status: classificationStatus,
        audio_source_key: audioSourceKey,
        transcript_status: transcriptStatus,
        word_comment_id: wordCommentIds[0] || null
      },
      uiConfig: {}
    });
  }

  // =========================================================================
  // PARSE PART 2 (p2RawLines) — 176 Questions, 44 Audio Blocks
  // =========================================================================
  const p2Questions = [];
  const p2Text = p2RawLines.join('\n');
  const p2TopicBlocks = p2Text.split(/(?=####\s*Topic:)/g);

  let p2SetIndex = 0;
  for (const topicStr of p2TopicBlocks) {
    if (!topicStr.trim() || !topicStr.includes('#### Topic:')) continue;

    p2SetIndex++;
    const formattedSet = String(p2SetIndex).padStart(3, '0');
    const groupKey = `listening-p2-set${formattedSet}`;

    const topicHeaderMatch = topicStr.match(/####\s*Topic:\s*(.*)/);
    const topicTitle = topicHeaderMatch ? topicHeaderMatch[1].trim() : `Part 2 Topic ${p2SetIndex}`;
    const groupName = `Listening Part 2: ${topicTitle}`;

    const audioKeyMatch = topicStr.match(/<!--\s*audio_source_key:\s*(listening-p2-set\d+-audio)\s*-->/);
    const audioSourceKey = audioKeyMatch ? audioKeyMatch[1] : `${groupKey}-audio`;

    const statusMatch = topicStr.match(/<!--\s*transcript_status:\s*(\w+)\s*-->/);
    const transcriptStatus = statusMatch ? statusMatch[1] : 'source_word_comments';

    const commentsMatch = topicStr.match(/<!--\s*word_comment_ids:\s*([\d,]+)\s*-->/);
    const wordCommentIds = commentsMatch ? commentsMatch[1].split(',').map(s => s.trim()) : [];

    const detailsMatch = topicStr.match(/<details class="audio-transcript">([\s\S]*?)<\/details>/i);
    const rawDetails = detailsMatch ? detailsMatch[1] : '';
    const transcriptText = cleanTranscriptContent(rawDetails);
    const speakerLabels = ['Person A', 'Person B', 'Person C', 'Person D'];

    const audioBlock = storeAudioBlock({
      sourceKey: audioSourceKey,
      partNumber: 2,
      title: `${groupName} Audio`,
      content: transcriptText,
      transcript: transcriptText,
      transcriptStatus: transcriptStatus,
      wordCommentIds: wordCommentIds,
      speakerLabels: speakerLabels
    });

    // Parse table rows
    const rowMatches = [...topicStr.matchAll(/<!--\s*source_key:\s*(listening-p2-set\d+-q\d+)\s*-->\r?\n\|\s*Person\s*(\d+)\s*\|\s*(.*?)\s*\|/gi)];
    if (rowMatches.length !== 4) {
      throw new Error(`[Parse Error] Part 2 Set ${groupKey} expects 4 question rows, found ${rowMatches.length}`);
    }

    const rawStatements = rowMatches.map(m => m[3].trim());
    const options = rawStatements.map((stmt, idx) => ({
      optionKey: String.fromCharCode(65 + idx),
      content: stmt,
      displayOrder: idx + 1
    }));

    for (let rIdx = 0; rIdx < rowMatches.length; rIdx++) {
      const match = rowMatches[rIdx];
      const sourceKey = match[1];
      const personNum = parseInt(match[2], 10);
      const statementText = match[3].trim();

      const matchedOption = options.find(o => o.content === statementText);

      p2Questions.push({
        skill: 'listening',
        partNumber: 2,
        questionType: 'listening_matching',
        questionNumber: personNum,
        sourceKey: sourceKey,
        groupKey: groupKey,
        groupName: groupName,
        content: `What does Person ${personNum} say regarding: ${topicTitle}?`,
        options: options,
        correctAnswer: { correct_option: matchedOption ? matchedOption.optionKey : 'A' },
        contentBlock: audioBlock,
        solutionData: {
          transcript: transcriptText,
          transcript_status: transcriptStatus,
          word_comment_ids: wordCommentIds,
          speaker_labels: speakerLabels
        },
        metadata: {
          source_section: 'part_2',
          task_type: 'information_matching',
          person_number: personNum,
          topic: topicTitle,
          audio_source_key: audioSourceKey,
          transcript_status: transcriptStatus
        },
        uiConfig: {}
      });
    }
  }

  // =========================================================================
  // PARSE PART 3 (p3RawLines) — 176 Questions, 44 Audio Blocks
  // =========================================================================
  const p3Questions = [];
  const p3Text = p3RawLines.join('\n');
  const p3TopicBlocks = p3Text.split(/(?=####\s*Topic:)/g);

  let p3SetIndex = 0;
  for (const topicStr of p3TopicBlocks) {
    if (!topicStr.trim() || !topicStr.includes('#### Topic:')) continue;

    p3SetIndex++;
    const formattedSet = String(p3SetIndex).padStart(3, '0');
    const groupKey = `listening-p3-set${formattedSet}`;

    const topicHeaderMatch = topicStr.match(/####\s*Topic:\s*(.*)/);
    const topicTitle = topicHeaderMatch ? topicHeaderMatch[1].trim() : `Part 3 Topic ${p3SetIndex}`;
    const groupName = `Listening Part 3: ${topicTitle}`;

    const audioKeyMatch = topicStr.match(/<!--\s*audio_source_key:\s*(listening-p3-set\d+-audio)\s*-->/);
    const audioSourceKey = audioKeyMatch ? audioKeyMatch[1] : `${groupKey}-audio`;

    const statusMatch = topicStr.match(/<!--\s*transcript_status:\s*(\w+)\s*-->/);
    const transcriptStatus = statusMatch ? statusMatch[1] : 'source_word_comment';

    const commentsMatch = topicStr.match(/<!--\s*word_comment_ids:\s*([\d,]+)\s*-->/);
    const wordCommentIds = commentsMatch ? commentsMatch[1].split(',').map(s => s.trim()) : [];

    const detailsMatch = topicStr.match(/<details class="audio-transcript">([\s\S]*?)<\/details>/i);
    const rawDetails = detailsMatch ? detailsMatch[1] : '';
    let transcriptText = cleanTranscriptContent(rawDetails);

    if (transcriptStatus === 'missing_source_comment') {
      transcriptText = null;
    }

    const speakerLabels = ['Man', 'Woman'];

    const audioBlock = storeAudioBlock({
      sourceKey: audioSourceKey,
      partNumber: 3,
      title: `${groupName} Audio`,
      content: transcriptText,
      transcript: transcriptText,
      transcriptStatus: transcriptStatus,
      wordCommentIds: wordCommentIds,
      speakerLabels: speakerLabels
    });

    const standardOptions = [
      { optionKey: 'man', content: 'Man', displayOrder: 1 },
      { optionKey: 'woman', content: 'Woman', displayOrder: 2 },
      { optionKey: 'both', content: 'Both', displayOrder: 3 }
    ];

    const rowMatches = [...topicStr.matchAll(/<!--\s*source_key:\s*(listening-p3-set\d+-q\d+)\s*-->\r?\n\|\s*(\d+)[\.\\]+\s*(.*?)\s*\|\s*(?:\*\*(.*?)\*\*|(.*?))\s*\|/gi)];
    if (rowMatches.length !== 4) {
      throw new Error(`[Parse Error] Part 3 Set ${groupKey} expects 4 question rows, found ${rowMatches.length}`);
    }

    for (let rIdx = 0; rIdx < rowMatches.length; rIdx++) {
      const match = rowMatches[rIdx];
      const sourceKey = match[1];
      const itemNum = parseInt(match[2], 10);
      const statementText = match[3].replace(/\\/g, '').trim();
      const rawAns = (match[4] || match[5] || '').trim().toUpperCase();

      let ansKey = null;
      if (rawAns === 'M') ansKey = 'man';
      else if (rawAns === 'W') ansKey = 'woman';
      else if (rawAns === 'B') ansKey = 'both';

      p3Questions.push({
        skill: 'listening',
        partNumber: 3,
        questionType: 'listening_matching',
        questionNumber: itemNum,
        sourceKey: sourceKey,
        groupKey: groupKey,
        groupName: groupName,
        content: statementText,
        options: standardOptions,
        correctAnswer: { correct_option: ansKey },
        contentBlock: audioBlock,
        solutionData: {
          transcript: transcriptText,
          transcript_status: transcriptStatus,
          word_comment_ids: wordCommentIds,
          speaker_labels: speakerLabels
        },
        metadata: {
          source_section: 'part_3',
          task_type: 'opinion_matching',
          statement_number: itemNum,
          topic: topicTitle,
          audio_source_key: audioSourceKey,
          transcript_status: transcriptStatus
        },
        uiConfig: {}
      });
    }
  }

  // =========================================================================
  // PARSE PART 4 (p4RawLines) — 120 Questions, 60 Audio Blocks
  // =========================================================================
  const p4Questions = [];
  const p4Text = p4RawLines.join('\n');
  const p4TopicBlocks = p4Text.split(/(?=(?:>\s*)?\*\*\s*Topic:)/gi);

  let p4SetIndex = 0;
  for (const topicStr of p4TopicBlocks) {
    if (!topicStr.trim() || !topicStr.includes('audio_source_key: listening-p4-')) continue;

    p4SetIndex++;
    const formattedSet = String(p4SetIndex).padStart(3, '0');
    const groupKey = `listening-p4-set${formattedSet}`;

    const topicHeaderMatch = topicStr.match(/>?\s*\*\*(?:Topic:\s*)?(.*?)\*\*/);
    const topicTitle = topicHeaderMatch ? topicHeaderMatch[1].trim() : `Part 4 Topic ${p4SetIndex}`;
    const groupName = `Listening Part 4: ${topicTitle}`;

    const audioKeyMatch = topicStr.match(/<!--\s*audio_source_key:\s*(listening-p4-set\d+-audio)\s*-->/);
    const audioSourceKey = audioKeyMatch ? audioKeyMatch[1] : `${groupKey}-audio`;

    const statusMatch = topicStr.match(/<!--\s*transcript_status:\s*(\w+)\s*-->/);
    const transcriptStatus = statusMatch ? statusMatch[1] : 'source_word_comment';

    const commentsMatch = topicStr.match(/<!--\s*word_comment_ids:\s*([\d,]+)\s*-->/);
    const wordCommentIds = commentsMatch ? commentsMatch[1].split(',').map(s => s.trim()) : [];

    const detailsMatch = topicStr.match(/<details class="audio-transcript">([\s\S]*?)<\/details>/i);
    const rawDetails = detailsMatch ? detailsMatch[1] : '';
    const transcriptText = cleanTranscriptContent(rawDetails);
    const speakerLabels = ['Speaker'];

    const audioBlock = storeAudioBlock({
      sourceKey: audioSourceKey,
      partNumber: 4,
      title: `${groupName} Audio`,
      content: transcriptText,
      transcript: transcriptText,
      transcriptStatus: transcriptStatus,
      wordCommentIds: wordCommentIds,
      speakerLabels: speakerLabels
    });

    const qBlocks = topicStr.split(/(?=<!--\s*source_key:\s*listening-p4-)/g);
    let qInSet = 0;

    for (const qStr of qBlocks) {
      if (!qStr.includes('<!-- source_key: listening-p4-')) continue;

      const sourceKeyMatch = qStr.match(/<!--\s*source_key:\s*(listening-p4-set\d+-q\d+)\s*-->/);
      if (!sourceKeyMatch) continue;

      qInSet++;
      const sourceKey = sourceKeyMatch[1];

      const qTextMatch = qStr.match(/>\s*\*\*(\d+(?:\.\d+)?)\.\s*(.*?)\*\*/);
      const questionText = qTextMatch ? qTextMatch[2].replace(/\\_/g, '_').trim() : '';

      const options = [];
      let underlinedKey = null;

      const optRegex = />\s*(<u>)?\s*([A-D])\.\s*(.*?)(<\/u>)?$/gm;
      let match;
      while ((match = optRegex.exec(qStr)) !== null) {
        const isUnderlined = Boolean(match[1] || match[4] || match[0].includes('<u>'));
        const optKey = match[2].toUpperCase();
        const optContent = match[3].replace(/<\/?[^>]+(>|$)/g, '').trim();

        if (isUnderlined) underlinedKey = optKey;

        options.push({
          optionKey: optKey,
          content: optContent,
          displayOrder: options.length + 1,
          isUnderlined: isUnderlined
        });
      }

      if (options.length === 0 || !underlinedKey) {
        throw new Error(`[Parse Error] Part 4 Question ${sourceKey} options or correct answer missing.`);
      }

      p4Questions.push({
        skill: 'listening',
        partNumber: 4,
        questionType: 'listening_multiple_choice',
        questionNumber: qInSet,
        sourceKey: sourceKey,
        groupKey: groupKey,
        groupName: groupName,
        content: questionText,
        options: options,
        correctAnswer: { correct_option: underlinedKey },
        contentBlock: audioBlock,
        solutionData: {
          transcript: transcriptText,
          transcript_status: transcriptStatus,
          word_comment_ids: wordCommentIds,
          speaker_labels: speakerLabels
        },
        metadata: {
          source_section: 'part_4',
          task_type: 'longer_monologues',
          topic: topicTitle,
          audio_source_key: audioSourceKey,
          transcript_status: transcriptStatus
        },
        uiConfig: {}
      });
    }
  }

  const allQuestions = [...p1Questions, ...p2Questions, ...p3Questions, ...p4Questions];

  for (const q of allQuestions) {
    q.contentHash = computeCanonicalHash(q);
  }

  return {
    p1Questions,
    p2Questions,
    p3Questions,
    p4Questions,
    allQuestions,
    contentBlocks: Array.from(contentBlocksMap.values())
  };
}

/**
 * Structural & Baseline Assertions
 */
function runAssertions(parsedData) {
  const { p1Questions, p2Questions, p3Questions, p4Questions, allQuestions, contentBlocks } = parsedData;

  console.log(`\n[Validation Assertions]`);
  console.log(`  Parsed Part 1 Questions: ${p1Questions.length} (Expected: ${BASELINE.p1Questions})`);
  console.log(`  Parsed Part 2 Questions: ${p2Questions.length} (Expected: ${BASELINE.p2Questions})`);
  console.log(`  Parsed Part 3 Questions: ${p3Questions.length} (Expected: ${BASELINE.p3Questions})`);
  console.log(`  Parsed Part 4 Questions: ${p4Questions.length} (Expected: ${BASELINE.p4Questions})`);
  console.log(`  Total Parsed Questions:  ${allQuestions.length} (Expected: ${BASELINE.totalQuestions})`);
  console.log(`  Total Audio Blocks:      ${contentBlocks.length} (Expected: ${BASELINE.totalAudioBlocks})`);

  if (p1Questions.length !== BASELINE.p1Questions) {
    throw new Error(`[Assertion Error] Part 1 questions count (${p1Questions.length}) !== expected (${BASELINE.p1Questions}).`);
  }
  if (p2Questions.length !== BASELINE.p2Questions) {
    throw new Error(`[Assertion Error] Part 2 questions count (${p2Questions.length}) !== expected (${BASELINE.p2Questions}).`);
  }
  if (p3Questions.length !== BASELINE.p3Questions) {
    throw new Error(`[Assertion Error] Part 3 questions count (${p3Questions.length}) !== expected (${BASELINE.p3Questions}).`);
  }
  if (p4Questions.length !== BASELINE.p4Questions) {
    throw new Error(`[Assertion Error] Part 4 questions count (${p4Questions.length}) !== expected (${BASELINE.p4Questions}).`);
  }
  if (allQuestions.length !== BASELINE.totalQuestions) {
    throw new Error(`[Assertion Error] Total questions (${allQuestions.length}) !== expected (${BASELINE.totalQuestions}).`);
  }
  if (contentBlocks.length !== BASELINE.totalAudioBlocks) {
    throw new Error(`[Assertion Error] Total audio blocks (${contentBlocks.length}) !== expected (${BASELINE.totalAudioBlocks}).`);
  }

  // Count Part 1 topic group occurrences
  const infoTypeCounts = {};
  for (const q of p1Questions) {
    const it = q.metadata.information_type;
    infoTypeCounts[it] = (infoTypeCounts[it] || 0) + 1;
  }
  console.log(`  Part 1 Topic Group Breakdown:`, infoTypeCounts);

  const topicCount = Object.keys(infoTypeCounts).length;
  if (topicCount !== BASELINE.p1TopicGroups) {
    throw new Error(`[Assertion Error] Part 1 topic group count (${topicCount}) !== expected (${BASELINE.p1TopicGroups}).`);
  }

  // Audio blocks with/without transcript
  const withTranscript = contentBlocks.filter(b => b.metadata.transcript_status !== 'missing_source_comment');
  const missingTranscript = contentBlocks.filter(b => b.metadata.transcript_status === 'missing_source_comment');

  console.log(`  Audio Blocks with Transcript: ${withTranscript.length} (Expected: ${BASELINE.audioWithTranscript})`);
  console.log(`  Audio Blocks missing Transcript: ${missingTranscript.length} (Expected: ${BASELINE.audioMissingTranscript})`);

  if (withTranscript.length !== BASELINE.audioWithTranscript || missingTranscript.length !== BASELINE.audioMissingTranscript) {
    throw new Error(`[Assertion Error] Audio block transcript status counts mismatch: withTranscript=${withTranscript.length}, missingTranscript=${missingTranscript.length}`);
  }

  if (missingTranscript[0].sourceKey !== 'listening-p3-set004-audio') {
    throw new Error(`[Assertion Error] Expected missing transcript block to be 'listening-p3-set004-audio', got '${missingTranscript[0].sourceKey}'`);
  }

  // Total Word Comments
  let totalComments = 0;
  for (const b of contentBlocks) {
    totalComments += (b.metadata.word_comment_ids || []).length;
  }
  console.log(`  Total Embedded Word Comments: ${totalComments} (Expected: ${BASELINE.totalWordComments})`);
  if (totalComments !== BASELINE.totalWordComments) {
    throw new Error(`[Assertion Error] Total Word comments (${totalComments}) !== expected (${BASELINE.totalWordComments})`);
  }

  const uniqueSourceKeys = new Set(allQuestions.map(q => q.sourceKey));
  if (allQuestions.length !== uniqueSourceKeys.size) {
    throw new Error(`[Assertion Error] Duplicate source_keys detected! Total: ${allQuestions.length}, Unique: ${uniqueSourceKeys.size}`);
  }

  const uniqueAudioKeys = new Set(contentBlocks.map(b => b.sourceKey));
  if (contentBlocks.length !== uniqueAudioKeys.size) {
    throw new Error(`[Assertion Error] Duplicate audio source_keys detected! Total: ${contentBlocks.length}, Unique: ${uniqueAudioKeys.size}`);
  }

  console.log(`  [ASSERTIONS PASSED] All structural & baseline checks completed successfully.`);
}

/**
 * Generate Complete Zero-Write Incremental SQL Seed File for Listening
 */
function generateSeedSql(parsedData) {
  const { p1Questions, allQuestions, contentBlocks } = parsedData;

  // Practice sets
  const groupsMap = new Map();
  for (const q of allQuestions) {
    if (!groupsMap.has(q.groupKey)) {
      groupsMap.set(q.groupKey, {
        skill: 'listening',
        groupType: 'practice_set',
        groupKey: q.groupKey,
        name: q.groupName,
        description: `Listening Practice Set (${q.groupKey})`,
        displayOrder: groupsMap.size + 1
      });
    }
  }

  // Part 1 Topic Groups
  for (const [topKey, topInfo] of Object.entries(PART1_TOPIC_GROUPS)) {
    const fullKey = topKey;
    if (!groupsMap.has(fullKey)) {
      groupsMap.set(fullKey, {
        skill: 'listening',
        groupType: 'topic',
        groupKey: topKey,
        name: topInfo.name,
        description: topInfo.description,
        displayOrder: groupsMap.size + 1
      });
    }
  }

  const lines = [
    `-- ============================================================================`,
    `-- Seed Data: Listening Skill Initial Import (Inline Transcripts - Zero-Write Incremental)`,
    `-- Generated at: ${new Date().toISOString()}`,
    `-- Total Questions: ${allQuestions.length}`,
    `-- Total Audio Blocks: ${contentBlocks.length}`,
    `-- Total Groups (Sets + Topics): ${groupsMap.size}`,
    `-- ============================================================================`,
    ``,
    `BEGIN;`,
    ``,
    `-- 0. Initialize Temporary Counters for Execution Metrics Tracking`,
    `CREATE TEMP TABLE IF NOT EXISTS _aptis_listening_stats (`,
    `  inserted_count INT DEFAULT 0,`,
    `  updated_count INT DEFAULT 0,`,
    `  unchanged_count INT DEFAULT 0,`,
    `  error_count INT DEFAULT 0`,
    `);`,
    `DELETE FROM _aptis_listening_stats;`,
    `INSERT INTO _aptis_listening_stats (inserted_count, updated_count, unchanged_count, error_count) VALUES (0, 0, 0, 0);`,
    ``,
    `-- 1. Upsert Listening Groups (Zero-Write)`,
    `INSERT INTO public.aptis_groups (skill, group_type, group_key, name, description, display_order, metadata)`,
    `VALUES`
  ];

  const groupValues = Array.from(groupsMap.values()).map(g =>
    `  ('listening'::public.aptis_skill_enum, ${sqlLiteral(g.groupType)}, ${sqlLiteral(g.groupKey)}, ${sqlLiteral(g.name)}, ${sqlLiteral(g.description)}, ${g.displayOrder}, '{}'::jsonb)`
  );
  lines.push(groupValues.join(',\n'));
  lines.push(`ON CONFLICT (skill, group_type, group_key)`);
  lines.push(`DO UPDATE SET`);
  lines.push(`  name = EXCLUDED.name,`);
  lines.push(`  description = EXCLUDED.description,`);
  lines.push(`  display_order = EXCLUDED.display_order,`);
  lines.push(`  updated_at = NOW()`);
  lines.push(`WHERE aptis_groups.name IS DISTINCT FROM EXCLUDED.name`);
  lines.push(`   OR aptis_groups.description IS DISTINCT FROM EXCLUDED.description`);
  lines.push(`   OR aptis_groups.display_order IS DISTINCT FROM EXCLUDED.display_order;`);

  lines.push(
    ``,
    `-- 2. Upsert Audio Content Blocks (Zero-Write via IS DISTINCT FROM)`,
    `INSERT INTO public.aptis_content_blocks (skill, block_type, source_key, title, content, metadata, content_hash)`,
    `VALUES`
  );

  const blockValues = contentBlocks.map(b =>
    `  ('listening'::public.aptis_skill_enum, ${sqlLiteral(b.blockType)}, ${sqlLiteral(b.sourceKey)}, ${sqlLiteral(b.title)}, ${sqlLiteral(b.content)}, ${sqlLiteral(JSON.stringify(b.metadata))}::jsonb, ${sqlLiteral(b.contentHash)})`
  );
  lines.push(blockValues.join(',\n'));
  lines.push(`ON CONFLICT (skill, source_key)`);
  lines.push(`DO UPDATE SET`);
  lines.push(`  title = EXCLUDED.title,`);
  lines.push(`  content = EXCLUDED.content,`);
  lines.push(`  metadata = EXCLUDED.metadata,`);
  lines.push(`  content_hash = EXCLUDED.content_hash,`);
  lines.push(`  updated_at = NOW()`);
  lines.push(`WHERE aptis_content_blocks.title IS DISTINCT FROM EXCLUDED.title`);
  lines.push(`   OR aptis_content_blocks.content IS DISTINCT FROM EXCLUDED.content`);
  lines.push(`   OR aptis_content_blocks.metadata IS DISTINCT FROM EXCLUDED.metadata`);
  lines.push(`   OR aptis_content_blocks.content_hash IS DISTINCT FROM EXCLUDED.content_hash;`);

  lines.push(
    ``,
    `-- 3. Upsert Questions Master Table & Record Incremental Metrics`,
    `WITH batch_data (skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash) AS (`,
    `  VALUES`
  );

  const qValues = allQuestions.map((q, idx) =>
    `    ('listening'::public.aptis_skill_enum, ${q.partNumber}, ${sqlLiteral(q.questionType)}, ${sqlLiteral(q.sourceKey)}, ${sqlLiteral(SOURCE_FILE_REL)}, ${sqlLiteral(q.content)}, ${idx + 1}, ${sqlLiteral(JSON.stringify(q.uiConfig))}::jsonb, ${sqlLiteral(JSON.stringify(q.metadata))}::jsonb, ${sqlLiteral(q.contentHash)})`
  );
  lines.push(qValues.join(',\n'));
  lines.push(`),`);
  lines.push(`existing_records AS (`);
  lines.push(`  SELECT q.source_key, q.content_hash`);
  lines.push(`  FROM public.aptis_questions q`);
  lines.push(`  WHERE q.skill = 'listening'::public.aptis_skill_enum`);
  lines.push(`),`);
  lines.push(`inserted_rows AS (`);
  lines.push(`  INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash)`);
  lines.push(`  SELECT bd.skill, bd.part_number, bd.question_type, bd.source_key, bd.source_file, bd.content, bd.display_order, bd.ui_config, bd.metadata, bd.content_hash`);
  lines.push(`  FROM batch_data bd`);
  lines.push(`  ON CONFLICT (skill, source_key)`);
  lines.push(`  DO UPDATE SET`);
  lines.push(`    part_number = EXCLUDED.part_number,`);
  lines.push(`    question_type = EXCLUDED.question_type,`);
  lines.push(`    source_file = EXCLUDED.source_file,`);
  lines.push(`    content = EXCLUDED.content,`);
  lines.push(`    display_order = EXCLUDED.display_order,`);
  lines.push(`    ui_config = EXCLUDED.ui_config,`);
  lines.push(`    metadata = EXCLUDED.metadata,`);
  lines.push(`    content_hash = EXCLUDED.content_hash,`);
  lines.push(`    import_status = 'updated'::public.aptis_question_status_enum,`);
  lines.push(`    last_changed_at = NOW(),`);
  lines.push(`    updated_at = NOW()`);
  lines.push(`  WHERE aptis_questions.content_hash IS DISTINCT FROM EXCLUDED.content_hash`);
  lines.push(`  RETURNING source_key, (xmax = 0) AS is_inserted`);
  lines.push(`)`);
  lines.push(`UPDATE _aptis_listening_stats SET`);
  lines.push(`  inserted_count = (SELECT COUNT(*) FROM inserted_rows WHERE is_inserted = TRUE),`);
  lines.push(`  updated_count = (SELECT COUNT(*) FROM inserted_rows WHERE is_inserted = FALSE),`);
  lines.push(`  unchanged_count = ${allQuestions.length} - (SELECT COUNT(*) FROM inserted_rows);`);

  lines.push(
    ``,
    `-- 4. Question-Group Links (Practice Sets & Part 1 Topics)`,
    `INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)`,
    `SELECT q.id, g.id, q.display_order`,
    `FROM public.aptis_questions q`,
    `JOIN public.aptis_groups g ON g.skill = q.skill AND (`,
    `  (g.group_type = 'practice_set' AND g.group_key = CASE`
  );

  const groupCaseLines = allQuestions.map(q => `    WHEN q.source_key = ${sqlLiteral(q.sourceKey)} THEN ${sqlLiteral(q.groupKey)}`);
  lines.push(groupCaseLines.join('\n'));
  lines.push(`  END) OR`);
  lines.push(`  (g.group_type = 'topic' AND g.group_key = (q.metadata->>'information_type'))`);
  lines.push(`)`);
  lines.push(`WHERE q.skill = 'listening'::public.aptis_skill_enum`);
  lines.push(`ON CONFLICT (question_id, group_id) DO NOTHING;`);

  lines.push(
    ``,
    `-- 5. Question-ContentBlock Links (Audio)`,
    `INSERT INTO public.aptis_question_content_blocks (question_id, content_block_id, content_role, display_order)`,
    `SELECT q.id, cb.id, 'audio', 1`,
    `FROM public.aptis_questions q`,
    `JOIN public.aptis_content_blocks cb ON cb.skill = q.skill AND cb.source_key = CASE`
  );

  const cbCaseLines = allQuestions.filter(q => q.contentBlock).map(q => `  WHEN q.source_key = ${sqlLiteral(q.sourceKey)} THEN ${sqlLiteral(q.contentBlock.sourceKey)}`);
  lines.push(cbCaseLines.join('\n'));
  lines.push(`END`);
  lines.push(`WHERE q.skill = 'listening'::public.aptis_skill_enum`);
  lines.push(`ON CONFLICT (question_id, content_block_id, content_role) DO NOTHING;`);

  lines.push(
    ``,
    `-- 6. Upsert Question Options (Zero-Write via IS DISTINCT FROM)`,
    `INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order, metadata)`,
    `SELECT q.id, opt.option_key, opt.content, opt.display_order, opt.metadata`,
    `FROM public.aptis_questions q`,
    `CROSS JOIN LATERAL (`
  );

  const optUnnestList = [];
  for (const q of allQuestions) {
    for (const o of q.options) {
      optUnnestList.push(
        `  SELECT ${sqlLiteral(q.sourceKey)} AS sk, ${sqlLiteral(o.optionKey)} AS option_key, ${sqlLiteral(o.content)} AS content, ${o.displayOrder} AS display_order, '{}'::jsonb AS metadata`
      );
    }
  }
  lines.push(optUnnestList.join('\n  UNION ALL\n'));
  lines.push(`) opt`);
  lines.push(`WHERE q.skill = 'listening'::public.aptis_skill_enum AND q.source_key = opt.sk`);
  lines.push(`ON CONFLICT (question_id, option_key)`);
  lines.push(`DO UPDATE SET`);
  lines.push(`  content = EXCLUDED.content,`);
  lines.push(`  display_order = EXCLUDED.display_order,`);
  lines.push(`  metadata = EXCLUDED.metadata`);
  lines.push(`WHERE aptis_question_options.content IS DISTINCT FROM EXCLUDED.content`);
  lines.push(`   OR aptis_question_options.display_order IS DISTINCT FROM EXCLUDED.display_order`);
  lines.push(`   OR aptis_question_options.metadata IS DISTINCT FROM EXCLUDED.metadata;`);

  lines.push(
    ``,
    `-- 7. Upsert Question Solutions & Answers (Zero-Write via IS DISTINCT FROM)`,
    `INSERT INTO public.aptis_question_answers (question_id, correct_answer, solution_data, updated_at)`,
    `SELECT q.id, ans.correct_answer, ans.solution_data, NOW()`,
    `FROM public.aptis_questions q`,
    `CROSS JOIN LATERAL (`
  );

  const ansUnnestList = allQuestions.map(q =>
    `  SELECT ${sqlLiteral(q.sourceKey)} AS sk, ${sqlLiteral(JSON.stringify(q.correctAnswer))}::jsonb AS correct_answer, ${sqlLiteral(JSON.stringify(q.solutionData))}::jsonb AS solution_data`
  );
  lines.push(ansUnnestList.join('\n  UNION ALL\n'));
  lines.push(`) ans`);
  lines.push(`WHERE q.skill = 'listening'::public.aptis_skill_enum AND q.source_key = ans.sk`);
  lines.push(`ON CONFLICT (question_id)`);
  lines.push(`DO UPDATE SET`);
  lines.push(`  correct_answer = EXCLUDED.correct_answer,`);
  lines.push(`  solution_data = EXCLUDED.solution_data,`);
  lines.push(`  updated_at = NOW()`);
  lines.push(`WHERE aptis_question_answers.correct_answer IS DISTINCT FROM EXCLUDED.correct_answer`);
  lines.push(`   OR aptis_question_answers.solution_data IS DISTINCT FROM EXCLUDED.solution_data;`);

  lines.push(
    ``,
    `-- 8. Log Import Run Results into aptis_import_runs Table (Strict Phase 0 Schema Compliance)`,
    `INSERT INTO public.aptis_import_runs (source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at)`,
    `SELECT `,
    `  ${sqlLiteral(SOURCE_FILE_REL)},`,
    `  'listening'::public.aptis_skill_enum,`,
    `  'completed',`,
    `  ${allQuestions.length},`,
    `  s.inserted_count,`,
    `  s.updated_count,`,
    `  s.unchanged_count,`,
    `  s.error_count,`,
    `  NOW(),`,
    `  NOW()`,
    `FROM _aptis_listening_stats s;`,
    ``,
    `COMMIT;`
  );

  return lines.join('\n');
}

/**
 * Generate/Update Manifest File
 */
function updateManifest(parsedData) {
  if (!fs.existsSync(MANIFEST_DIR)) {
    fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  }

  let existingManifest = [];
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
      existingManifest = Array.isArray(raw) ? raw : (raw.questions || []);
    } catch (e) {
      existingManifest = [];
    }
  }

  const existingMap = new Map();
  for (const item of existingManifest) {
    if (item && item.source_key) {
      existingMap.set(item.source_key, item);
    }
  }

  const currentKeys = new Set(parsedData.allQuestions.map(q => q.sourceKey));
  const nowIso = new Date().toISOString();

  let addedCount = 0;
  let retainedCount = 0;
  let removedStaleCount = 0;

  for (const key of existingMap.keys()) {
    if (!currentKeys.has(key)) {
      removedStaleCount++;
    }
  }

  const finalQuestionsManifest = [];

  for (const q of parsedData.allQuestions) {
    const prev = existingMap.get(q.sourceKey);
    const audioKey = q.contentBlock ? q.contentBlock.sourceKey : null;
    const transcriptStatus = q.solutionData ? q.solutionData.transcript_status : 'missing_source_comment';

    if (!prev) {
      addedCount++;
      finalQuestionsManifest.push({
        skill: 'listening',
        part: q.partNumber,
        source_file: SOURCE_FILE_REL,
        source_key: q.sourceKey,
        group_key: q.groupKey,
        information_type: q.metadata.information_type || null,
        classification_status: q.metadata.classification_status || 'reviewed',
        audio_source_key: audioKey,
        transcript_status: transcriptStatus,
        content_block_keys: audioKey ? [audioKey] : [],
        initial_content_hash: q.contentHash,
        current_content_hash: q.contentHash,
        first_created_at: nowIso,
        last_imported_at: nowIso,
        status: 'active'
      });
    } else {
      retainedCount++;
      const isHashChanged = prev.current_content_hash !== q.contentHash;
      finalQuestionsManifest.push({
        skill: 'listening',
        part: q.partNumber,
        source_file: SOURCE_FILE_REL,
        source_key: q.sourceKey,
        group_key: q.groupKey,
        information_type: q.metadata.information_type || null,
        classification_status: q.metadata.classification_status || 'reviewed',
        audio_source_key: audioKey,
        transcript_status: transcriptStatus,
        content_block_keys: audioKey ? [audioKey] : [],
        initial_content_hash: prev.initial_content_hash || q.contentHash,
        current_content_hash: q.contentHash,
        first_created_at: prev.first_created_at || nowIso,
        last_imported_at: isHashChanged ? nowIso : (prev.last_imported_at || nowIso),
        status: 'active'
      });
    }
  }

  finalQuestionsManifest.sort((a, b) => a.source_key.localeCompare(b.source_key));

  const audioBlocksManifest = parsedData.contentBlocks.map(b => ({
    source_key: b.sourceKey,
    part_number: b.partNumber,
    transcript_status: b.metadata.transcript_status,
    word_comment_ids: b.metadata.word_comment_ids,
    speaker_labels: b.metadata.speaker_labels,
    content_hash: b.contentHash
  }));

  const activeCount = finalQuestionsManifest.length;
  const manifestKeys = new Set(finalQuestionsManifest.map(m => m.source_key));
  const duplicateCount = activeCount - manifestKeys.size;

  if (activeCount !== BASELINE.totalQuestions) {
    throw new Error(`[Manifest Assertion Error] Manifest count (${activeCount}) !== expected (${BASELINE.totalQuestions}).`);
  }
  if (manifestKeys.size !== BASELINE.totalQuestions) {
    throw new Error(`[Manifest Assertion Error] Unique manifest keys (${manifestKeys.size}) !== expected (${BASELINE.totalQuestions}).`);
  }

  console.log(`\n[Manifest Metrics]`);
  console.log(`  active_count:        ${activeCount}`);
  console.log(`  added_count:         ${addedCount}`);
  console.log(`  retained_count:      ${retainedCount}`);
  console.log(`  removed_stale_count: ${removedStaleCount}`);
  console.log(`  duplicate_count:     ${duplicateCount}`);
  console.log(`  audio_blocks_count:  ${audioBlocksManifest.length}`);

  const manifestData = finalQuestionsManifest;
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`[Phase 3B] Manifest written to ${path.relative(projectRoot, MANIFEST_FILE)} (${finalQuestionsManifest.length} active items)`);

  return {
    activeCount,
    addedCount,
    retainedCount,
    removedStaleCount,
    duplicateCount,
    audioBlocksCount: audioBlocksManifest.length
  };
}

/**
 * Generate Phase 3B Listening Report File
 */
function generateReport(parsedData, manifestMetrics) {
  const { p1Questions, p2Questions, p3Questions, p4Questions, allQuestions, contentBlocks } = parsedData;

  const p1SetsCount = new Set(p1Questions.map(q => q.groupKey)).size;
  const p2SetsCount = new Set(p2Questions.map(q => q.groupKey)).size;
  const p3SetsCount = new Set(p3Questions.map(q => q.groupKey)).size;
  const p4SetsCount = new Set(p4Questions.map(q => q.groupKey)).size;
  const totalSetsCount = p1SetsCount + p2SetsCount + p3SetsCount + p4SetsCount;

  const p1AudioCount = new Set(p1Questions.map(q => q.contentBlock.sourceKey)).size;
  const p2AudioCount = new Set(p2Questions.map(q => q.contentBlock.sourceKey)).size;
  const p3AudioCount = new Set(p3Questions.map(q => q.contentBlock.sourceKey)).size;
  const p4AudioCount = new Set(p4Questions.map(q => q.contentBlock.sourceKey)).size;

  const withTranscript = contentBlocks.filter(b => b.metadata.transcript_status !== 'missing_source_comment').length;
  const missingTranscript = contentBlocks.filter(b => b.metadata.transcript_status === 'missing_source_comment').length;

  const reportContent = `# Phase 3B — Listening Inline Transcripts Import Report

## 1. Thông Tin Nguồn & Phân Vùng
- **File nguồn thực tế**: \`${SOURCE_FILE_REL}\`
- **Skill**: \`listening\`
- **Thời gian xử lý**: \`${new Date().toISOString()}\`
- **Cấu trúc transcript**: Inline \`<details class="audio-transcript">\` lấy từ Word Comments.

---

## 2. Thống Kê Dữ Liệu Từng Part

| Part | Tên Dạng Bài | Số lượng Question | Số Practice Set | Số Audio Block | Question Type | Transcript Status |
|------|--------------|-------------------|-----------------|----------------|---------------|-------------------|
| **Part 1** | Information Recognition | ${p1Questions.length} câu | ${p1SetsCount} sets (13 câu/set) | ${p1AudioCount} audio blocks | \`multiple_choice\` | \`source_word_comment\` |
| **Part 2** | Information Matching | ${p2Questions.length} câu | ${p2SetsCount} sets (4 câu/set) | ${p2AudioCount} audio blocks | \`listening_matching\` | \`source_word_comments\` |
| **Part 3** | Speaker / Opinion Matching | ${p3Questions.length} câu | ${p3SetsCount} sets (4 câu/set) | ${p3AudioCount} audio blocks | \`listening_matching\` | 43 \`source_word_comment\`, 1 \`missing_source_comment\` |
| **Part 4** | Longer Monologues | ${p4Questions.length} câu | ${p4SetsCount} sets (2 câu/set) | ${p4AudioCount} audio blocks | \`listening_multiple_choice\` | \`source_word_comment\` |
| **TỔNG** | **Toàn bộ Listening** | **${allQuestions.length} câu** | **${totalSetsCount} sets** | **${contentBlocks.length} blocks** | - | **${withTranscript} có script, ${missingTranscript} thiếu script** |

- **Tổng số Word Comments**: 565 comments.
- **Part 1 Topic Groups**: 8 topic groups (\`time_date_duration\`, \`numbers_money_codes\`, \`places_directions\`, \`travel_transport_mode\`, \`people_relationships\`, \`reasons_opinions_purpose\`, \`objects_descriptions\`, \`activities_events_details\`).
- **Missing Transcript Audio Block**: \`listening-p3-set004-audio\` (Topic: Information and technology).

---

## 3. Thống Kê Manifest

| Chỉ Số Manifest | Giá Trị | Mô Tả |
|------------------|---------|-------|
| **active_count** | ${manifestMetrics.activeCount} | Số question record khớp 100% kết quả parse |
| **audio_blocks_count** | ${manifestMetrics.audioBlocksCount} | Số audio content block |
| **added_count** | ${manifestMetrics.addedCount} | Số question key mới |
| **retained_count** | ${manifestMetrics.retainedCount} | Số question key giữ nguyên |
| **removed_stale_count** | ${manifestMetrics.removedStaleCount} | Số key cũ đã dọn dẹp |
| **duplicate_count** | ${manifestMetrics.duplicateCount} | Key trùng lặp (yêu cầu = 0) |

---

## 4. Cơ Chế Zero-Write Incremental

Khi thực thi seed SQL trên cơ sở dữ liệu:
1. **Lần đầu import**: Upsert đủ 758 câu, 434 audio blocks, 178 groups.
2. **Lần chạy lại không đổi**: So sánh \`content_hash IS DISTINCT FROM EXCLUDED.content_hash\`.
   - Kết quả: \`inserted_count = 0\`, \`updated_count = 0\`, \`unchanged_count = 758\`, \`error_count = 0\`.

---

## 5. Bảo Vệ Đáp Án & Transcript

- Frontend public payload chỉ query qua public service API (không query \`aptis_question_answers\`).
- Solutions & Transcripts được lưu trong \`aptis_question_answers.solution_data\` và \`aptis_content_blocks.metadata\`.

---

## 6. Trạng Thái Hoàn Thành

Static Listening inline transcript and database integration completed — runtime verification pending.
`;

  fs.writeFileSync(REPORT_FILE, reportContent, 'utf8');
  console.log(`[Phase 3B] Report generated at ${path.relative(projectRoot, REPORT_FILE)}`);
}

/**
 * MAIN EXECUTION WORKFLOW
 */
function main() {
  console.log(`====================================================`);
  console.log(`[Phase 3B] APTIS Listening Importer (Inline Transcripts)...`);
  console.log(`Source File: ${SOURCE_FILE_REL}`);
  console.log(`====================================================`);

  // PASS 1: Read source file & parse
  let fileContent = fs.readFileSync(SOURCE_FILE_ABS, 'utf8');
  const pass1Data = parseListeningSkill(fileContent);

  // PASS 2: Read source file again & verify 100% identity
  fileContent = fs.readFileSync(SOURCE_FILE_ABS, 'utf8');
  const pass2Data = parseListeningSkill(fileContent);

  console.log(`\n[Two-Pass Verification]`);
  if (pass1Data.allQuestions.length !== pass2Data.allQuestions.length) {
    throw new Error(`[Two-Pass Error] Question count mismatch: Pass 1 (${pass1Data.allQuestions.length}) !== Pass 2 (${pass2Data.allQuestions.length})`);
  }

  for (let i = 0; i < pass1Data.allQuestions.length; i++) {
    const q1 = pass1Data.allQuestions[i];
    const q2 = pass2Data.allQuestions[i];

    if (q1.sourceKey !== q2.sourceKey || q1.contentHash !== q2.contentHash || q1.groupKey !== q2.groupKey) {
      throw new Error(`[Two-Pass Error] Question mismatch at index ${i}: Pass 1 (${q1.sourceKey}) !== Pass 2 (${q2.sourceKey})`);
    }
  }
  console.log(`  [VERIFICATION PASSED] Pass 1 and Pass 2 parsed data match 100%.`);

  // Run Structural & Baseline Assertions
  runAssertions(pass2Data);

  // Update Manifest & Validate Strict Assertions
  const manifestMetrics = updateManifest(pass2Data);

  // Generate SQL Seed File
  const seedSql = generateSeedSql(pass2Data);
  fs.writeFileSync(SEED_FILE, seedSql, 'utf8');
  console.log(`[Phase 3B] Seed SQL file written to ${path.relative(projectRoot, SEED_FILE)}`);

  // Generate Report
  generateReport(pass2Data, manifestMetrics);

  console.log(`\n====================================================`);
  console.log(`[Phase 3B SUCCESS] Listening Inline Transcripts Importer Completed!`);
  console.log(`====================================================`);
}

main();
