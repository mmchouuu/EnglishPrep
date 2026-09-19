import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const CANDIDATE_SOURCE_PATHS = [
  path.join(projectRoot, 'docs', 'aptis', '05-writing.md'),
  path.join(projectRoot, 'docs', '05-writing.md')
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
  throw new Error(`[Phase 3D Error] Writing source file not found in candidate paths: ${CANDIDATE_SOURCE_PATHS.join(', ')}`);
}

const MANIFEST_DIR = path.join(projectRoot, 'docs', 'aptis', 'manifests');
const MANIFEST_FILE = path.join(MANIFEST_DIR, 'writing.json');
const SEED_FILE = path.join(projectRoot, 'supabase', 'seed_writing.sql');
const REPORT_FILE = path.join(projectRoot, 'docs', 'aptis', 'phase3-writing-report.md');

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

function computeInstructionsBlockHash(sourceKey, content) {
  const obj = canonicalize({
    block_type: 'instructions',
    content: content || '',
    skill: 'writing'
  });
  return crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
}

/**
 * Computes canonical hash for a writing question.
 * MUST NOT contain: timestamp, UUID, run_id, absolute path, or question's own source_key.
 */
function computeCanonicalHash(q) {
  const rawObj = {
    content: q.content,
    correct_answer: null,
    metadata: q.metadata || {},
    options: [],
    part_number: q.partNumber,
    question_type: q.questionType,
    skill: 'writing',
    ui_config: q.uiConfig || {}
  };

  if (q.contentBlocks && q.contentBlocks.length > 0) {
    rawObj.content_blocks = q.contentBlocks.map(cb => ({
      source_key: cb.sourceKey,
      content_hash: cb.contentHash
    })).sort((a, b) => a.source_key.localeCompare(b.source_key));
  }

  const canonicalObj = canonicalize(rawObj);
  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj), 'utf8').digest('hex');
}

function stripComments(str) {
  return str.replace(/<!--[\s\S]*?-->/g, '');
}

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Detect Section Headings dynamically in the file.
 */
function detectHeadings(lines) {
  let p1Idx = -1;
  let p2Idx = -1;
  let p3Idx = -1;
  let p4Idx = -1;

  for (let i = 0; i < lines.length; i++) {
    const cleanLine = stripComments(lines[i]).trim();
    if (p1Idx === -1 && /Part\s*1\s*:/i.test(cleanLine)) {
      p1Idx = i;
    } else if (p2Idx === -1 && /Part\s*2\s*:/i.test(cleanLine)) {
      p2Idx = i;
    } else if (p3Idx === -1 && /Part\s*3\s*:/i.test(cleanLine)) {
      p3Idx = i;
    } else if (p4Idx === -1 && /Part\s*4\s*:/i.test(cleanLine)) {
      p4Idx = i;
    }
  }

  if (p1Idx === -1 || p2Idx === -1 || p3Idx === -1 || p4Idx === -1) {
    throw new Error(`[Heading Detection Failed] Found: Part1=${p1Idx}, Part2=${p2Idx}, Part3=${p3Idx}, Part4=${p4Idx}`);
  }

  if (!(p1Idx < p2Idx && p2Idx < p3Idx && p3Idx < p4Idx)) {
    throw new Error(`[Heading Order Invalid] Indices: Part1=${p1Idx}, Part2=${p2Idx}, Part3=${p3Idx}, Part4=${p4Idx}`);
  }

  return { p1Idx, p2Idx, p3Idx, p4Idx };
}

/**
 * Helper to ensure unique group_key and track groups
 */
function getOrCreateGroup(groupsMap, clubTitle, partNumber) {
  let baseName = clubTitle
    .replace(/–\s*Part\s*\d+.*$/i, '')
    .replace(/\s*\(\d{4}\)$/i, '')
    .trim();

  let groupKey = `writing-club-${slugify(baseName)}`;
  
  if (!groupsMap.has(groupKey)) {
    groupsMap.set(groupKey, {
      groupKey: groupKey,
      skill: 'writing',
      groupType: 'club',
      name: baseName,
      description: `Writing practice tasks for ${baseName}`,
      displayOrder: groupsMap.size + 1,
      metadata: {
        club_title: baseName
      }
    });
  }

  return groupsMap.get(groupKey);
}

/**
 * Parse Part 1 (Word-level writing - 5 short answers)
 */
function parsePart1(lines, groupsMap, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const questions = [];
  const answers = [];

  // Match Markdown table headers
  const tableRegex = /\|\s*\*\*([^*]+)\*\*\s*\|[^\n]*\n\|[-|\s]+\|\n([\s\S]*?)(?=\n\s*\n|\|\s*\*\*|$)/gi;
  let match;
  let clubOccurrenceCounter = {};

  while ((match = tableRegex.exec(cleanContent)) !== null) {
    const rawHeader = cleanText(match[1]);
    const tableBody = match[2];

    const group = getOrCreateGroup(groupsMap, rawHeader, 1);
    const clubSlug = slugify(group.name);

    if (!clubOccurrenceCounter[clubSlug]) {
      clubOccurrenceCounter[clubSlug] = 1;
    } else {
      clubOccurrenceCounter[clubSlug]++;
    }

    const setSuffix = clubOccurrenceCounter[clubSlug] > 1 ? `-set${String(clubOccurrenceCounter[clubSlug]).padStart(3, '0')}` : '';

    const rowRegex = /\|\s*([^|\n]+)\s*\|\s*([^|\n]*)\s*\|/g;
    let rowMatch;
    let qCounter = 1;

    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const qText = cleanText(rowMatch[1]);
      const ansText = cleanText(rowMatch[2]);

      if (qText && !qText.startsWith('---')) {
        const qNumStr = String(qCounter).padStart(3, '0');
        const questionSourceKey = `writing-${clubSlug}${setSuffix}-p1-q${qNumStr}`;
        const displayOrder = qCounter;
        qCounter++;

        const uiConfig = {
          input_type: 'textarea',
          word_counter: true,
          autosave: true,
          submit_individually: true,
          submit_with_club: true
        };

        const metadata = {
          club_key: group.groupKey,
          topic: group.name,
          task_type: 'short_answer',
          min_words: 1,
          max_words: 5,
          tone: null,
          recipient_type: null,
          source_section: 'part_1'
        };

        const qObj = {
          sourceKey: questionSourceKey,
          groupKey: group.groupKey,
          groupType: 'club',
          skill: 'writing',
          partNumber: 1,
          questionType: 'text_input',
          content: qText,
          displayOrder: displayOrder,
          metadata: metadata,
          uiConfig: uiConfig,
          contentBlocks: []
        };

        qObj.contentHash = computeCanonicalHash(qObj);
        questions.push(qObj);

        answers.push({
          questionSourceKey: questionSourceKey,
          solutionData: {
            sample_answer: ansText || null,
            model_answer: ansText || null,
            explanation: null,
            rubric: null,
            status: {
              missing_model_answer: !ansText,
              missing_rubric: true
            }
          }
        });
      }
    }
  }

  return { questions, answers };
}

/**
 * Parse Part 2 (Short text writing - 20–30 words)
 */
function parsePart2(lines, groupsMap, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const questions = [];
  const answers = [];

  const tableRegex = /\|\s*\*\*([^*]+)\*\*\s*\|[^\n]*\n\|[-|\s]+\|\n([\s\S]*?)(?=\n\s*\n|\|\s*\*\*|$)/gi;
  let match;
  let clubOccurrenceCounter = {};

  while ((match = tableRegex.exec(cleanContent)) !== null) {
    const rawHeader = cleanText(match[1]);
    const tableBody = match[2];

    const group = getOrCreateGroup(groupsMap, rawHeader, 2);
    const clubSlug = slugify(group.name);

    if (!clubOccurrenceCounter[clubSlug]) {
      clubOccurrenceCounter[clubSlug] = 1;
    } else {
      clubOccurrenceCounter[clubSlug]++;
    }

    const setSuffix = clubOccurrenceCounter[clubSlug] > 1 ? `-set${String(clubOccurrenceCounter[clubSlug]).padStart(3, '0')}` : '';

    const rowRegex = /\|\s*([^|\n]+)\s*\|\s*([^|\n]*)\s*\|/g;
    let rowMatch;
    let qCounter = 1;

    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const qText = cleanText(rowMatch[1]);
      const ansText = cleanText(rowMatch[2]);

      if (qText && !qText.startsWith('---')) {
        const qNumStr = String(qCounter).padStart(3, '0');
        const questionSourceKey = `writing-${clubSlug}${setSuffix}-p2-q${qNumStr}`;
        const displayOrder = qCounter;
        qCounter++;

        const uiConfig = {
          input_type: 'textarea',
          word_counter: true,
          autosave: true,
          submit_individually: true,
          submit_with_club: true
        };

        const metadata = {
          club_key: group.groupKey,
          topic: group.name,
          task_type: 'short_text',
          min_words: 20,
          max_words: 30,
          tone: 'neutral',
          recipient_type: null,
          source_section: 'part_2'
        };

        const qObj = {
          sourceKey: questionSourceKey,
          groupKey: group.groupKey,
          groupType: 'club',
          skill: 'writing',
          partNumber: 2,
          questionType: 'text_input',
          content: qText,
          displayOrder: displayOrder,
          metadata: metadata,
          uiConfig: uiConfig,
          contentBlocks: []
        };

        qObj.contentHash = computeCanonicalHash(qObj);
        questions.push(qObj);

        answers.push({
          questionSourceKey: questionSourceKey,
          solutionData: {
            sample_answer: ansText || null,
            model_answer: ansText || null,
            explanation: null,
            rubric: null,
            status: {
              missing_model_answer: !ansText,
              missing_rubric: true
            }
          }
        });
      }
    }
  }

  return { questions, answers };
}

/**
 * Parse Part 3 (Three written responses - 3 responses)
 */
function parsePart3(lines, groupsMap, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const questions = [];
  const answers = [];

  const tableRegex = /\|\s*\*\*([^*]+)\*\*\s*\|[^\n]*\n\|[-|\s]+\|\n([\s\S]*?)(?=\n\s*\n|\|\s*\*\*|$)/gi;
  let match;
  let clubOccurrenceCounter = {};

  while ((match = tableRegex.exec(cleanContent)) !== null) {
    const rawHeader = cleanText(match[1]);
    const tableBody = match[2];

    const group = getOrCreateGroup(groupsMap, rawHeader, 3);
    const clubSlug = slugify(group.name);

    if (!clubOccurrenceCounter[clubSlug]) {
      clubOccurrenceCounter[clubSlug] = 1;
    } else {
      clubOccurrenceCounter[clubSlug]++;
    }

    const setSuffix = clubOccurrenceCounter[clubSlug] > 1 ? `-set${String(clubOccurrenceCounter[clubSlug]).padStart(3, '0')}` : '';

    const rowRegex = /\|\s*([^|\n]+)\s*\|\s*([^|\n]*)\s*\|/g;
    let rowMatch;
    let qCounter = 1;

    while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
      const qText = cleanText(rowMatch[1]);
      const ansText = cleanText(rowMatch[2]);

      if (qText && !qText.startsWith('---')) {
        const qNumStr = String(qCounter).padStart(3, '0');
        const questionSourceKey = `writing-${clubSlug}${setSuffix}-p3-q${qNumStr}`;
        const displayOrder = qCounter;
        qCounter++;

        const uiConfig = {
          input_type: 'textarea',
          word_counter: true,
          autosave: true,
          submit_individually: true,
          submit_with_club: true
        };

        const metadata = {
          club_key: group.groupKey,
          topic: group.name,
          task_type: 'chat_response',
          min_words: 30,
          max_words: 40,
          tone: 'informal',
          recipient_type: 'member',
          source_section: 'part_3'
        };

        const qObj = {
          sourceKey: questionSourceKey,
          groupKey: group.groupKey,
          groupType: 'club',
          skill: 'writing',
          partNumber: 3,
          questionType: 'text_input',
          content: qText,
          displayOrder: displayOrder,
          metadata: metadata,
          uiConfig: uiConfig,
          contentBlocks: []
        };

        qObj.contentHash = computeCanonicalHash(qObj);
        questions.push(qObj);

        answers.push({
          questionSourceKey: questionSourceKey,
          solutionData: {
            sample_answer: ansText || null,
            model_answer: ansText || null,
            explanation: null,
            rubric: null,
            status: {
              missing_model_answer: !ansText,
              missing_rubric: true
            }
          }
        });
      }
    }
  }

  return { questions, answers };
}

/**
 * Parse Part 4 (Formal & informal emails)
 */
function parsePart4(lines, groupsMap, anomalies) {
  const content = lines.join('\n');
  const cleanContent = stripComments(content);

  const contentBlocks = [];
  const questionContentBlocks = [];
  const questions = [];
  const answers = [];

  // Match HTML tables in Part 4 containing Club notice and 2 email rows
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let match;
  let clubOccurrenceCounter = {};

  while ((match = tableRegex.exec(cleanContent)) !== null) {
    const tableHtml = match[1];

    // Skip general template tables at the start of Part 4
    if (/Mẫu email/i.test(tableHtml)) continue;

    // Match Header row with Club title (e.g., Fashion Club – Part 4 (2026))
    const headerMatch = /<th[^>]*>\s*<strong>\s*([^<]+?–\s*Part\s*4[^<]*)\s*<\/strong>\s*<\/th>/i.exec(tableHtml);
    if (!headerMatch) continue;

    const rawHeader = cleanText(headerMatch[1]);
    const group = getOrCreateGroup(groupsMap, rawHeader, 4);
    const clubSlug = slugify(group.name);

    if (!clubOccurrenceCounter[clubSlug]) {
      clubOccurrenceCounter[clubSlug] = 1;
    } else {
      clubOccurrenceCounter[clubSlug]++;
    }

    const setSuffix = clubOccurrenceCounter[clubSlug] > 1 ? `-set${String(clubOccurrenceCounter[clubSlug]).padStart(3, '0')}` : '';

    // Extract Club notice text
    let noticeText = '';
    const noticeMatch = /<th[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/th>/i.exec(tableHtml);
    if (noticeMatch) {
      noticeText = cleanText(noticeMatch[1]);
    }

    // Create instructions Content Block for Club Notice
    let linkedContentBlocks = [];
    if (noticeText) {
      const cbSourceKey = `writing-${clubSlug}${setSuffix}-p4-instructions`;
      const cbHash = computeInstructionsBlockHash(cbSourceKey, noticeText);
      const cbObj = {
        sourceKey: cbSourceKey,
        skill: 'writing',
        partNumber: 4,
        blockType: 'instructions',
        title: `Club Notice for ${group.name}`,
        content: noticeText,
        mediaUrl: null,
        contentHash: cbHash,
        contentRole: 'instructions',
        metadata: { instructions_type: 'club_notice' }
      };
      contentBlocks.push(cbObj);
      linkedContentBlocks.push(cbObj);
    }

    // Extract <tr> rows in tbody (Informal email & Formal email)
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    let qCounter = 1;

    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const rowHtml = trMatch[1];
      if (/Club notice|Part 4/i.test(rowHtml)) continue;

      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        cells.push(tdMatch[1]);
      }

      if (cells.length >= 1) {
        const qText = cleanText(cells[0]);
        const ansText = cleanText(cells[1] || '');

        if (qText) {
          const isInformal = /friend|informal|40-50|50 words/i.test(qText);
          const isFormal = /manager|president|formal|120-150/i.test(qText);

          const taskType = isInformal ? 'informal_email' : (isFormal ? 'formal_email' : `email_task_${qCounter}`);
          const tone = isInformal ? 'informal' : (isFormal ? 'formal' : 'neutral');
          const minWords = isInformal ? 40 : (isFormal ? 120 : 40);
          const maxWords = isInformal ? 50 : (isFormal ? 150 : 150);
          const recipientType = isInformal ? 'friend' : (isFormal ? 'manager' : 'recipient');

          const qNumStr = String(qCounter).padStart(3, '0');
          const questionSourceKey = `writing-${clubSlug}${setSuffix}-p4-q${qNumStr}`;
          const displayOrder = qCounter;
          qCounter++;

          const uiConfig = {
            input_type: 'textarea',
            word_counter: true,
            autosave: true,
            submit_individually: true,
            submit_with_club: true
          };

          const metadata = {
            club_key: group.groupKey,
            topic: group.name,
            task_type: taskType,
            min_words: minWords,
            max_words: maxWords,
            tone: tone,
            recipient_type: recipientType,
            source_section: 'part_4'
          };

          const qObj = {
            sourceKey: questionSourceKey,
            groupKey: group.groupKey,
            groupType: 'club',
            skill: 'writing',
            partNumber: 4,
            questionType: 'email_writing',
            content: qText,
            displayOrder: displayOrder,
            metadata: metadata,
            uiConfig: uiConfig,
            contentBlocks: linkedContentBlocks
          };

          qObj.contentHash = computeCanonicalHash(qObj);
          questions.push(qObj);

          if (linkedContentBlocks.length > 0) {
            questionContentBlocks.push({
              questionSourceKey: questionSourceKey,
              contentBlockSourceKey: linkedContentBlocks[0].sourceKey,
              contentRole: 'instructions',
              displayOrder: 1
            });
          }

          answers.push({
            questionSourceKey: questionSourceKey,
            solutionData: {
              sample_answer: ansText || null,
              model_answer: ansText || null,
              explanation: null,
              rubric: null,
              status: {
                missing_model_answer: !ansText,
                missing_rubric: true
              }
            }
          });
        }
      }
    }
  }

  return { contentBlocks, questionContentBlocks, questions, answers };
}

/**
 * Main Importer Execution with Two-Pass Verification
 */
function runImporter() {
  console.log('====================================================');
  console.log('[Phase 3D] APTIS Writing Importer Running...');
  console.log(`Source File: ${SOURCE_FILE_REL}`);
  console.log('====================================================');

  const anomalies = [];
  const groupsMap = new Map();

  // PASS 1: Read & Parse
  const rawContent = fs.readFileSync(SOURCE_FILE_ABS, 'utf8');
  const lines = rawContent.split(/\r?\n/);
  const headings = detectHeadings(lines);

  const p1Lines = lines.slice(headings.p1Idx, headings.p2Idx);
  const p2Lines = lines.slice(headings.p2Idx, headings.p3Idx);
  const p3Lines = lines.slice(headings.p3Idx, headings.p4Idx);
  const p4Lines = lines.slice(headings.p4Idx);

  const resP1 = parsePart1(p1Lines, groupsMap, anomalies);
  const resP2 = parsePart2(p2Lines, groupsMap, anomalies);
  const resP3 = parsePart3(p3Lines, groupsMap, anomalies);
  const resP4 = parsePart4(p4Lines, groupsMap, anomalies);

  const allGroups = Array.from(groupsMap.values());
  const allContentBlocks = [...resP4.contentBlocks];
  const allQuestionContentBlocks = [...resP4.questionContentBlocks];
  const allQuestions = [...resP1.questions, ...resP2.questions, ...resP3.questions, ...resP4.questions];
  const allAnswers = [...resP1.answers, ...resP2.answers, ...resP3.answers, ...resP4.answers];

  // Structural assertions & duplicate key checks
  const uniqueKeys = new Set();
  const duplicateKeys = [];
  for (const q of allQuestions) {
    if (uniqueKeys.has(q.sourceKey)) {
      duplicateKeys.push(q.sourceKey);
    }
    uniqueKeys.add(q.sourceKey);
  }
  if (duplicateKeys.length > 0) {
    anomalies.push(`Duplicate source_keys found: ${duplicateKeys.join(', ')}`);
  }

  const missingAnswersCount = allAnswers.filter(a => !a.solutionData.model_answer).length;

  console.log(`\n====================================================`);
  console.log(`[PASS 1 INSPECTION SUMMARY]`);
  console.log(`  Total Clubs / Groups: ${allGroups.length}`);
  console.log(`  Part 1 Questions: ${resP1.questions.length}`);
  console.log(`  Part 2 Questions: ${resP2.questions.length}`);
  console.log(`  Part 3 Questions: ${resP3.questions.length}`);
  console.log(`  Part 4 Questions: ${resP4.questions.length} (Instructions Content Blocks: ${resP4.contentBlocks.length})`);
  console.log(`  Total Logical Questions: ${allQuestions.length}`);
  console.log(`  Duplicate Source Keys: ${duplicateKeys.length}`);
  console.log(`  Missing Model Answers: ${missingAnswersCount}`);
  console.log(`  Anomalies Count: ${anomalies.length}`);
  console.log(`====================================================\n`);

  if (anomalies.length > 0) {
    console.error(`[ANOMALIES DETECTED - IMPORTER ABORTED!]`);
    anomalies.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    throw new Error(`Import aborted due to ${anomalies.length} unresolved structural anomalies.`);
  }

  // PASS 2: Re-read & Re-verify
  const pass2GroupsMap = new Map();
  const pass2Raw = fs.readFileSync(SOURCE_FILE_ABS, 'utf8');
  const pass2Lines = pass2Raw.split(/\r?\n/);
  const pass2Headings = detectHeadings(pass2Lines);

  const p2_resP1 = parsePart1(pass2Lines.slice(pass2Headings.p1Idx, pass2Headings.p2Idx), pass2GroupsMap, []);
  const p2_resP2 = parsePart2(pass2Lines.slice(pass2Headings.p2Idx, pass2Headings.p3Idx), pass2GroupsMap, []);
  const p2_resP3 = parsePart3(pass2Lines.slice(pass2Headings.p3Idx, pass2Headings.p4Idx), pass2GroupsMap, []);
  const p2_resP4 = parsePart4(pass2Lines.slice(pass2Headings.p4Idx), pass2GroupsMap, []);

  const pass2Questions = [...p2_resP1.questions, ...p2_resP2.questions, ...p2_resP3.questions, ...p2_resP4.questions];

  if (allQuestions.length !== pass2Questions.length) {
    throw new Error(`[Two-Pass Verification Failed] Pass 1 questions (${allQuestions.length}) !== Pass 2 questions (${pass2Questions.length})`);
  }

  for (let i = 0; i < allQuestions.length; i++) {
    const q1 = allQuestions[i];
    const q2 = pass2Questions[i];
    if (q1.sourceKey !== q2.sourceKey || q1.contentHash !== q2.contentHash) {
      throw new Error(`[Two-Pass Mismatch at index ${i}] Pass 1: ${q1.sourceKey} (${q1.contentHash}) !== Pass 2: ${q2.sourceKey} (${q2.contentHash})`);
    }
  }

  console.log(`[VERIFICATION PASSED] Two-pass consistency verified 100% for ${allQuestions.length} questions.`);

  // Write Manifest
  fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  const manifestData = allQuestions.map(q => ({
    source_key: q.sourceKey,
    content_hash: q.contentHash,
    part_number: q.partNumber,
    question_type: q.questionType
  }));
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`[Manifest Written] ${MANIFEST_FILE} (${manifestData.length} records)`);

  // Write Seed SQL - 100% Compliant with Phase 0 Schema!
  let sql = `-- APTIS Writing Initial Seed Data (Phase 3D)\n`;
  sql += `-- Generated on ${new Date().toISOString()}\n`;
  sql += `-- Fully compliant with Phase 0 schema (20260910000000_create_aptis_system.sql)\n\n`;
  sql += `BEGIN;\n\n`;

  // 1. Log import run into aptis_import_runs
  sql += `-- Log import run\n`;
  sql += `INSERT INTO public.aptis_import_runs (\n`;
  sql += `  source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at\n`;
  sql += `) VALUES (\n`;
  sql += `  ${sqlLiteral(SOURCE_FILE_REL)}, 'writing'::public.aptis_skill_enum, 'completed', ${allQuestions.length}, 0, 0, ${allQuestions.length}, 0, NOW(), NOW()\n`;
  sql += `);\n\n`;

  // 2. Upsert aptis_groups
  sql += `-- Upsert aptis_groups\n`;
  sql += `INSERT INTO public.aptis_groups (skill, group_type, group_key, name, description, display_order, metadata)\nVALUES\n`;
  const groupRows = allGroups.map(g => 
    `  ('writing'::public.aptis_skill_enum, ${sqlLiteral(g.groupType)}, ${sqlLiteral(g.groupKey)}, ${sqlLiteral(g.name)}, ${sqlLiteral(g.description)}, ${g.displayOrder}, ${sqlLiteral(JSON.stringify(g.metadata))}::jsonb)`
  );
  sql += groupRows.join(',\n') + `\n`;
  sql += `ON CONFLICT (skill, group_type, group_key) DO UPDATE SET\n`;
  sql += `  name = EXCLUDED.name,\n`;
  sql += `  description = EXCLUDED.description,\n`;
  sql += `  display_order = EXCLUDED.display_order,\n`;
  sql += `  metadata = EXCLUDED.metadata\n`;
  sql += `WHERE aptis_groups.name IS DISTINCT FROM EXCLUDED.name\n`;
  sql += `   OR aptis_groups.description IS DISTINCT FROM EXCLUDED.description\n`;
  sql += `   OR aptis_groups.display_order IS DISTINCT FROM EXCLUDED.display_order\n`;
  sql += `   OR aptis_groups.metadata IS DISTINCT FROM EXCLUDED.metadata;\n\n`;

  // 3. Upsert aptis_content_blocks
  if (allContentBlocks.length > 0) {
    sql += `-- Upsert aptis_content_blocks\n`;
    sql += `INSERT INTO public.aptis_content_blocks (skill, block_type, source_key, title, content, media_url, metadata, content_hash)\nVALUES\n`;
    const cbRows = allContentBlocks.map(cb =>
      `  ('writing'::public.aptis_skill_enum, ${sqlLiteral(cb.blockType)}, ${sqlLiteral(cb.sourceKey)}, ${sqlLiteral(cb.title)}, ${sqlLiteral(cb.content)}, ${sqlLiteral(cb.mediaUrl)}, ${sqlLiteral(JSON.stringify(cb.metadata))}::jsonb, ${sqlLiteral(cb.contentHash)})`
    );
    sql += cbRows.join(',\n') + `\n`;
    sql += `ON CONFLICT (skill, source_key) DO UPDATE SET\n`;
    sql += `  title = EXCLUDED.title,\n`;
    sql += `  content = EXCLUDED.content,\n`;
    sql += `  media_url = EXCLUDED.media_url,\n`;
    sql += `  metadata = EXCLUDED.metadata,\n`;
    sql += `  content_hash = EXCLUDED.content_hash\n`;
    sql += `WHERE aptis_content_blocks.title IS DISTINCT FROM EXCLUDED.title\n`;
    sql += `   OR aptis_content_blocks.content IS DISTINCT FROM EXCLUDED.content\n`;
    sql += `   OR aptis_content_blocks.media_url IS DISTINCT FROM EXCLUDED.media_url\n`;
    sql += `   OR aptis_content_blocks.metadata IS DISTINCT FROM EXCLUDED.metadata\n`;
    sql += `   OR aptis_content_blocks.content_hash IS DISTINCT FROM EXCLUDED.content_hash;\n\n`;
  }

  // 4. Upsert aptis_questions
  sql += `-- Upsert aptis_questions\n`;
  sql += `INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash)\nVALUES\n`;
  const qRows = allQuestions.map(q =>
    `  ('writing'::public.aptis_skill_enum, ${q.partNumber}, ${sqlLiteral(q.questionType)}, ${sqlLiteral(q.sourceKey)}, ${sqlLiteral(SOURCE_FILE_REL)}, ${sqlLiteral(q.content)}, ${q.displayOrder}, ${sqlLiteral(JSON.stringify(q.uiConfig))}::jsonb, ${sqlLiteral(JSON.stringify(q.metadata))}::jsonb, ${sqlLiteral(q.contentHash)})`
  );
  sql += qRows.join(',\n') + `\n`;
  sql += `ON CONFLICT (skill, source_key) DO UPDATE SET\n`;
  sql += `  part_number = EXCLUDED.part_number,\n`;
  sql += `  question_type = EXCLUDED.question_type,\n`;
  sql += `  source_file = EXCLUDED.source_file,\n`;
  sql += `  content = EXCLUDED.content,\n`;
  sql += `  display_order = EXCLUDED.display_order,\n`;
  sql += `  ui_config = EXCLUDED.ui_config,\n`;
  sql += `  metadata = EXCLUDED.metadata,\n`;
  sql += `  content_hash = EXCLUDED.content_hash\n`;
  sql += `WHERE aptis_questions.content IS DISTINCT FROM EXCLUDED.content\n`;
  sql += `   OR aptis_questions.ui_config IS DISTINCT FROM EXCLUDED.ui_config\n`;
  sql += `   OR aptis_questions.metadata IS DISTINCT FROM EXCLUDED.metadata\n`;
  sql += `   OR aptis_questions.content_hash IS DISTINCT FROM EXCLUDED.content_hash;\n\n`;

  // 5. Upsert aptis_question_groups
  sql += `-- Upsert aptis_question_groups\n`;
  sql += `INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)\n`;
  sql += `SELECT q.id, g.id, qg.display_order\n`;
  sql += `FROM (VALUES\n`;
  const qgRows = allQuestions.map(q =>
    `  (${sqlLiteral(q.sourceKey)}, ${sqlLiteral(q.groupType)}, ${sqlLiteral(q.groupKey)}, ${q.displayOrder})`
  );
  sql += qgRows.join(',\n') + `\n`;
  sql += `) AS qg(question_source_key, group_type, group_key, display_order)\n`;
  sql += `JOIN public.aptis_questions q ON q.skill = 'writing'::public.aptis_skill_enum AND q.source_key = qg.question_source_key\n`;
  sql += `JOIN public.aptis_groups g ON g.skill = 'writing'::public.aptis_skill_enum AND g.group_type = qg.group_type AND g.group_key = qg.group_key\n`;
  sql += `ON CONFLICT (question_id, group_id) DO UPDATE SET\n`;
  sql += `  display_order = EXCLUDED.display_order\n`;
  sql += `WHERE aptis_question_groups.display_order IS DISTINCT FROM EXCLUDED.display_order;\n\n`;

  // 6. Upsert aptis_question_content_blocks
  if (allQuestionContentBlocks.length > 0) {
    sql += `-- Upsert aptis_question_content_blocks\n`;
    sql += `INSERT INTO public.aptis_question_content_blocks (question_id, content_block_id, content_role, display_order)\n`;
    sql += `SELECT q.id, cb.id, qcb.content_role, qcb.display_order\n`;
    sql += `FROM (VALUES\n`;
    const qcbRows = allQuestionContentBlocks.map(qcb =>
      `  (${sqlLiteral(qcb.questionSourceKey)}, ${sqlLiteral(qcb.contentBlockSourceKey)}, ${sqlLiteral(qcb.contentRole)}, ${qcb.displayOrder})`
    );
    sql += qcbRows.join(',\n') + `\n`;
    sql += `) AS qcb(question_source_key, content_block_source_key, content_role, display_order)\n`;
    sql += `JOIN public.aptis_questions q ON q.skill = 'writing'::public.aptis_skill_enum AND q.source_key = qcb.question_source_key\n`;
    sql += `JOIN public.aptis_content_blocks cb ON cb.skill = 'writing'::public.aptis_skill_enum AND cb.source_key = qcb.content_block_source_key\n`;
    sql += `ON CONFLICT (question_id, content_block_id, content_role) DO UPDATE SET\n`;
    sql += `  display_order = EXCLUDED.display_order\n`;
    sql += `WHERE aptis_question_content_blocks.display_order IS DISTINCT FROM EXCLUDED.display_order;\n\n`;
  }

  // 7. Upsert aptis_question_answers
  sql += `-- Upsert aptis_question_answers (private solution data table)\n`;
  sql += `INSERT INTO public.aptis_question_answers (question_id, solution_data)\n`;
  sql += `SELECT q.id, a.solution_data::jsonb\n`;
  sql += `FROM (VALUES\n`;
  const ansRows = allAnswers.map(ans =>
    `  (${sqlLiteral(ans.questionSourceKey)}, ${sqlLiteral(JSON.stringify(ans.solutionData))})`
  );
  sql += ansRows.join(',\n') + `\n`;
  sql += `) AS a(question_source_key, solution_data)\n`;
  sql += `JOIN public.aptis_questions q ON q.skill = 'writing'::public.aptis_skill_enum AND q.source_key = a.question_source_key\n`;
  sql += `ON CONFLICT (question_id) DO UPDATE SET\n`;
  sql += `  solution_data = EXCLUDED.solution_data\n`;
  sql += `WHERE aptis_question_answers.solution_data IS DISTINCT FROM EXCLUDED.solution_data;\n\n`;

  sql += `COMMIT;\n`;

  fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
  fs.writeFileSync(SEED_FILE, sql, 'utf8');
  console.log(`[Seed SQL Written] ${SEED_FILE}`);

  // Write Report
  const reportMD = `# APTIS Phase 3D — Writing Initial Import Report

## Summary
- **Source File**: \`${SOURCE_FILE_REL}\`
- **Total Logical Questions**: ${allQuestions.length}
- **Total Clubs / Groups**: ${allGroups.length}
- **Total Instructions Content Blocks**: ${allContentBlocks.length}

## Breakdown by Part
| Part | Title | Task Type | Word Limits | Tone | Recipient Type | Question Count |
|---|---|---|---|---|---|---|
| Part 1 | Word-level writing | Short answer | 1–5 words | Neutral | None | ${resP1.questions.length} |
| Part 2 | Short text writing | Short text | 20–30 words | Neutral | None | ${resP2.questions.length} |
| Part 3 | Three written responses | Chat response | 30–40 words | Informal | Member | ${resP3.questions.length} |
| Part 4 | Formal & informal emails | Informal email & Formal email | 40–50 / 120–150 words | Informal / Formal | Friend / Manager | ${resP4.questions.length} |

## Source Key & Content Hash Conventions
- **Question Key Format**: \`writing-<club-slug>-p<part>-q<NNN>\`
- **Instructions Content Block Format**: \`writing-<club-slug>-p4-instructions\`
- **Canonical Hash**: Derived deterministically from \`skill\`, \`part_number\`, \`question_type\`, \`content\`, \`metadata\`, \`ui_config\`, and bound instructions \`content_hash\`es. Contains NO timestamps, UUIDs, run_ids, or absolute paths.

## Database Schema Alignment (Phase 0 Compliant)
- \`aptis_groups\`: \`skill, group_type, group_key, name, description, display_order, metadata\` (Unique constraint: \`skill, group_type, group_key\`).
- \`aptis_questions\`: \`skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash\` (Unique constraint: \`skill, source_key\`).
- \`aptis_question_groups\`: \`question_id, group_id, display_order\`.
- \`aptis_content_blocks\`: \`skill, block_type, source_key, title, content, media_url, metadata, content_hash\`.
- \`aptis_question_content_blocks\`: \`question_id, content_block_id, content_role, display_order\`.
- \`aptis_question_answers\`: \`question_id, solution_data\`.
- \`aptis_import_runs\`: \`source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at\`.

## Missing Data Tracking
- **Missing Model Answers**: ${missingAnswersCount}
- **Missing Rubric**: Handled with \`missing_rubric = true\` in solution_data status.

## Incremental Zero-Write Strategy
- Implemented using PostgreSQL \`ON CONFLICT ... DO UPDATE WHERE ... IS DISTINCT FROM ...\`.
- Re-running the seed SQL on an unchanged database performs 0 actual row updates.
- Transactional integrity guaranteed with \`BEGIN\` and \`COMMIT\`.
`;

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, reportMD, 'utf8');
  console.log(`[Report Written] ${REPORT_FILE}`);

  console.log('\n[Phase 3D Initial Import Prep Completed Successfully!]');
}

runImporter();
