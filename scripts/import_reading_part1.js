import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Resolve source file path strictly from specified candidate locations
const CANDIDATE_SOURCE_PATHS = [
  path.join(projectRoot, 'docs', 'aptis', '02-reading.md'),
  path.join(projectRoot, 'docs', '02-reading.md')
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
  throw new Error(`[Phase 2 Error] Source file not found in specified paths: ${CANDIDATE_SOURCE_PATHS.join(', ')}`);
}

const MANIFEST_DIR = path.join(projectRoot, 'docs', 'aptis', 'manifests');
const MANIFEST_FILE = path.join(MANIFEST_DIR, 'reading.json');
const SEED_FILE = path.join(projectRoot, 'supabase', 'seed_reading_part1_5q.sql');

/**
 * Escapes a string for standard SQL string literals safely.
 */
function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Generates deterministic SHA-256 content hash from canonical JSON structure.
 */
function computeCanonicalHash(q) {
  const canonicalObj = {
    content: q.content,
    correct_answer: { correct_option: q.correctOption },
    metadata: {},
    options: q.options.map(o => ({
      content: o.content,
      display_order: o.displayOrder,
      option_key: o.optionKey
    })).sort((a, b) => a.display_order - b.display_order),
    part_number: 1,
    question_type: 'multiple_choice',
    skill: 'reading',
    ui_config: {}
  };

  const sortedKeys = Object.keys(canonicalObj).sort();
  const sortedObj = {};
  for (const k of sortedKeys) {
    sortedObj[k] = canonicalObj[k];
  }

  const canonicalJson = JSON.stringify(sortedObj);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/**
 * Idempotently inserts HTML markers in markdown source file.
 * Throws an error if an existing marker conflicts with the expected source key.
 */
function ensureMarkersInMarkdown(filePath, questions) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let modified = false;

  for (const q of questions) {
    const expectedMarker = `<!-- source_key: ${q.sourceKey} -->`;
    const qHeaderRegex = new RegExp(`^>\\s*\\*\\*${q.questionNumber}\\.\\s*`);

    for (let i = 0; i < lines.length; i++) {
      if (qHeaderRegex.test(lines[i].trim())) {
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        const markerMatch = prevLine.match(/^<!--\s*source_key:\s*([^\s]+)\s*-->$/);

        if (markerMatch) {
          const existingKey = markerMatch[1];
          if (existingKey !== q.sourceKey) {
            throw new Error(`[Marker Error] Question ${q.questionNumber} already has a conflicting marker '${existingKey}', expected '${q.sourceKey}'.`);
          }
          // Exact marker already present, no modification needed
        } else {
          lines.splice(i, 0, expectedMarker);
          modified = true;
        }
        break;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`[Phase 2] Idempotently updated source_key markers in ${filePath}`);
  }
}

/**
 * Parses Reading Part 1 questions and validates exactly 1 correct answer per question.
 */
function parseReadingPart1(filePath, maxQuestions = 5) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split(/\r?\n/);

  const parsedQuestions = [];
  let currentQ = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const qMatch = line.match(/^>\s*\*\*(\d+)\.\s*(.*?)\*\*$/);
    if (qMatch) {
      const qNum = parseInt(qMatch[1], 10);

      if (qNum > maxQuestions || parsedQuestions.length >= maxQuestions) {
        if (currentQ) {
          parsedQuestions.push(currentQ);
          currentQ = null;
        }
        break;
      }

      if (currentQ) {
        parsedQuestions.push(currentQ);
      }

      const formattedQNum = String(qNum).padStart(3, '0');
      const sourceKey = `reading-p1-set001-q${formattedQNum}`;
      const rawContent = qMatch[2].replace(/\\_/g, '_');

      currentQ = {
        questionNumber: qNum,
        sourceKey: sourceKey,
        content: rawContent,
        options: []
      };
      continue;
    }

    if (currentQ) {
      const optMatch = line.match(/^>\s*(<u>)?([A-Z])\.\s*(.*?)(<\/u>)?$/);
      if (optMatch) {
        const isUnderlined = Boolean(optMatch[1] && optMatch[4]);
        const optionKey = optMatch[2];
        const optionText = optMatch[3].replace(/<\/?[^>]+(>|$)/g, '').trim();

        currentQ.options.push({
          optionKey: optionKey,
          content: optionText,
          displayOrder: currentQ.options.length + 1,
          isUnderlined: isUnderlined
        });
      }
    }
  }

  if (currentQ && parsedQuestions.length < maxQuestions && currentQ.questionNumber <= maxQuestions) {
    if (!parsedQuestions.some(q => q.questionNumber === currentQ.questionNumber)) {
      parsedQuestions.push(currentQ);
    }
  }

  if (parsedQuestions.length !== maxQuestions) {
    throw new Error(`[Parse Validation Error] Expected exactly ${maxQuestions} questions, but parsed ${parsedQuestions.length}`);
  }

  // Strict validation: Exactly 1 underlined correct option per question
  for (const q of parsedQuestions) {
    if (!q.options || q.options.length === 0) {
      throw new Error(`[Parse Validation Error] Question ${q.sourceKey} has no options.`);
    }

    const underlinedOptions = q.options.filter(o => o.isUnderlined);
    if (underlinedOptions.length !== 1) {
      throw new Error(`[Parse Validation Error] Question ${q.sourceKey} must have exactly 1 correct answer (underlined), but found ${underlinedOptions.length}.`);
    }

    q.correctOption = underlinedOptions[0].optionKey;
  }

  return parsedQuestions;
}

/**
 * Updates or creates reading.json manifest preserving initial timestamps.
 */
function updateManifest(manifestFile, sourceFileRel, questionsWithHash) {
  const now = new Date().toISOString();
  let existingManifest = null;

  if (fs.existsSync(manifestFile)) {
    try {
      const raw = fs.readFileSync(manifestFile, 'utf8');
      existingManifest = JSON.parse(raw);
    } catch (e) {
      console.warn(`[Manifest Warning] Could not parse existing manifest at ${manifestFile}.`);
    }
  }

  const existingQuestionsMap = new Map();
  if (existingManifest && Array.isArray(existingManifest.questions)) {
    for (const q of existingManifest.questions) {
      if (q.source_key) {
        existingQuestionsMap.set(q.source_key, q);
      }
    }
  }

  const updatedQuestions = questionsWithHash.map(q => {
    const existing = existingQuestionsMap.get(q.sourceKey);
    const firstCreatedAt = existing?.first_created_at || now;
    const initialContentHash = existing?.initial_content_hash || q.contentHash;

    return {
      skill: 'reading',
      part: 1,
      source_file: sourceFileRel,
      source_key: q.sourceKey,
      initial_content_hash: initialContentHash,
      current_content_hash: q.contentHash,
      first_created_at: firstCreatedAt,
      last_imported_at: now
    };
  });

  if (existingManifest && Array.isArray(existingManifest.questions)) {
    for (const q of existingManifest.questions) {
      if (q.source_key && !updatedQuestions.some(uq => uq.source_key === q.source_key)) {
        updatedQuestions.push(q);
      }
    }
  }

  const manifestData = {
    skill: 'reading',
    part: 1,
    source_file: sourceFileRel,
    last_updated_at: now,
    questions: updatedQuestions
  };

  const dir = path.dirname(manifestFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(manifestFile, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`[Phase 2] Manifest generated at: ${path.relative(projectRoot, manifestFile)}`);
}

/**
 * Generates SQL seed script with zero-write guarantees and safe dollar-tag block.
 */
function generateSeedSql(seedFile, sourceFileRel, questionsWithHash, runId, startTime) {
  const dollarTag = '$aptis_import$';

  // Verify custom dollar tag is safe from injection
  for (const q of questionsWithHash) {
    if (q.content.includes(dollarTag)) {
      throw new Error(`[SQL Security Error] Question content contains dollar-tag delimiter ${dollarTag}`);
    }
    for (const opt of q.options) {
      if (opt.content.includes(dollarTag)) {
        throw new Error(`[SQL Security Error] Option content contains dollar-tag delimiter ${dollarTag}`);
      }
    }
  }

  let sql = `-- ============================================================================\n`;
  sql += `-- Seed: Reading Part 1 (First 5 Questions)\n`;
  sql += `-- Generated at: ${startTime}\n`;
  sql += `-- Source: ${sourceFileRel}\n`;
  sql += `-- ============================================================================\n\n`;

  sql += `BEGIN;\n\n`;
  sql += `DO ${dollarTag}\n`;
  sql += `DECLARE\n`;
  sql += `  v_run_id UUID := '${runId}';\n`;
  sql += `  v_start_time TIMESTAMPTZ := '${startTime}';\n`;
  sql += `  v_group_id UUID;\n`;
  sql += `  v_inserted INT := 0;\n`;
  sql += `  v_updated INT := 0;\n`;
  sql += `  v_unchanged INT := 0;\n`;
  sql += `  v_q_id UUID;\n`;
  sql += `  v_old_hash VARCHAR(64);\n`;
  sql += `  v_old_status public.aptis_question_status_enum;\n`;
  sql += `BEGIN\n`;
  sql += `  -- 1. Record Audit Log Entry (Status: running)\n`;
  sql += `  INSERT INTO public.aptis_import_runs (id, source_file, skill, status, total_parsed, started_at)\n`;
  sql += `  VALUES (v_run_id, ${sqlLiteral(sourceFileRel)}, 'reading', 'running', ${questionsWithHash.length}, v_start_time);\n\n`;

  sql += `  -- 2. Ensure Practice Set Group Exists (Zero-write if unchanged)\n`;
  sql += `  INSERT INTO public.aptis_groups (skill, group_type, group_key, name, display_order)\n`;
  sql += `  VALUES ('reading'::public.aptis_skill_enum, 'practice_set', 'reading-p1-set001', 'Reading Part 1 Set 001', 1)\n`;
  sql += `  ON CONFLICT (skill, group_type, group_key) DO NOTHING;\n\n`;

  sql += `  SELECT id INTO v_group_id\n`;
  sql += `  FROM public.aptis_groups\n`;
  sql += `  WHERE skill = 'reading'::public.aptis_skill_enum\n`;
  sql += `    AND group_type = 'practice_set'\n`;
  sql += `    AND group_key = 'reading-p1-set001';\n\n`;

  sql += `  IF v_group_id IS NULL THEN\n`;
  sql += `    RAISE EXCEPTION 'Failed to resolve group_id for practice_set reading-p1-set001';\n`;
  sql += `  END IF;\n\n`;

  for (const q of questionsWithHash) {
    const safeContent = sqlLiteral(q.content);
    const answerJsonStr = JSON.stringify({ correct_option: q.correctOption });
    const safeAnswerJson = sqlLiteral(answerJsonStr);
    const safeSourceKey = sqlLiteral(q.sourceKey);

    sql += `  ----------------------------------------------------------------------------\n`;
    sql += `  -- Question ${q.questionNumber}: ${q.sourceKey}\n`;
    sql += `  ----------------------------------------------------------------------------\n`;
    sql += `  v_q_id := NULL;\n`;
    sql += `  v_old_hash := NULL;\n`;
    sql += `  SELECT id, content_hash, import_status INTO v_q_id, v_old_hash, v_old_status\n`;
    sql += `  FROM public.aptis_questions\n`;
    sql += `  WHERE skill = 'reading' AND source_key = ${safeSourceKey};\n\n`;

    sql += `  IF v_q_id IS NULL THEN\n`;
    sql += `    -- New Question Insert\n`;
    sql += `    INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, metadata, ui_config, content_hash, import_status, first_imported_at, last_changed_at)\n`;
    sql += `    VALUES ('reading'::public.aptis_skill_enum, 1, 'multiple_choice', ${safeSourceKey}, ${sqlLiteral(sourceFileRel)}, ${safeContent}, ${q.questionNumber}, '{}'::jsonb, '{}'::jsonb, ${sqlLiteral(q.contentHash)}, 'imported'::public.aptis_question_status_enum, NOW(), NOW())\n`;
    sql += `    RETURNING id INTO v_q_id;\n\n`;

    sql += `    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)\n`;
    sql += `    VALUES\n`;
    const optRows = q.options.map(o => `      (v_q_id, ${sqlLiteral(o.optionKey)}, ${sqlLiteral(o.content)}, ${o.displayOrder})`).join(',\n');
    sql += optRows + `\n`;
    sql += `    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;\n\n`;

    sql += `    INSERT INTO public.aptis_question_answers (question_id, correct_answer)\n`;
    sql += `    VALUES (v_q_id, ${safeAnswerJson}::jsonb)\n`;
    sql += `    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;\n\n`;

    sql += `    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)\n`;
    sql += `    VALUES (v_q_id, v_group_id, ${q.questionNumber})\n`;
    sql += `    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;\n\n`;

    sql += `    v_inserted := v_inserted + 1;\n\n`;

    sql += `  ELSIF v_old_hash <> ${sqlLiteral(q.contentHash)} THEN\n`;
    sql += `    -- Changed Question Update (Complete field refresh)\n`;
    sql += `    UPDATE public.aptis_questions\n`;
    sql += `    SET part_number = 1,\n`;
    sql += `        question_type = 'multiple_choice',\n`;
    sql += `        source_file = ${sqlLiteral(sourceFileRel)},\n`;
    sql += `        content = ${safeContent},\n`;
    sql += `        display_order = ${q.questionNumber},\n`;
    sql += `        metadata = '{}'::jsonb,\n`;
    sql += `        ui_config = '{}'::jsonb,\n`;
    sql += `        content_hash = ${sqlLiteral(q.contentHash)},\n`;
    sql += `        import_status = 'updated'::public.aptis_question_status_enum,\n`;
    sql += `        last_changed_at = NOW()\n`;
    sql += `    WHERE id = v_q_id;\n\n`;

    sql += `    -- Remove stale options before inserting fresh option set\n`;
    sql += `    DELETE FROM public.aptis_question_options WHERE question_id = v_q_id;\n\n`;

    sql += `    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)\n`;
    sql += `    VALUES\n`;
    sql += optRows + `\n`;
    sql += `    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;\n\n`;

    sql += `    INSERT INTO public.aptis_question_answers (question_id, correct_answer)\n`;
    sql += `    VALUES (v_q_id, ${safeAnswerJson}::jsonb)\n`;
    sql += `    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;\n\n`;

    sql += `    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)\n`;
    sql += `    VALUES (v_q_id, v_group_id, ${q.questionNumber})\n`;
    sql += `    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;\n\n`;

    sql += `    v_updated := v_updated + 1;\n\n`;

    sql += `  ELSE\n`;
    sql += `    -- Unchanged Question (Zero-write on question/options/answer)\n`;
    sql += `    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)\n`;
    sql += `    VALUES (v_q_id, v_group_id, ${q.questionNumber})\n`;
    sql += `    ON CONFLICT (question_id, group_id) DO NOTHING;\n\n`;

    sql += `    v_unchanged := v_unchanged + 1;\n`;
    sql += `  END IF;\n\n`;
  }

  sql += `  -- Update audit log on successful transaction completion\n`;
  sql += `  UPDATE public.aptis_import_runs\n`;
  sql += `  SET status = 'completed',\n`;
  sql += `      inserted_count = v_inserted,\n`;
  sql += `      updated_count = v_updated,\n`;
  sql += `      unchanged_count = v_unchanged,\n`;
  sql += `      error_count = 0,\n`;
  sql += `      completed_at = NOW()\n`;
  sql += `  WHERE id = v_run_id;\n\n`;

  sql += `EXCEPTION WHEN OTHERS THEN\n`;
  sql += `  -- Note: The transaction block is atomic. Any unhandled exception triggers a RAISE\n`;
  sql += `  -- which rolls back all data modifications made within this transaction, including aptis_import_runs.\n`;
  sql += `  RAISE;\n`;
  sql += `END ${dollarTag};\n\n`;
  sql += `COMMIT;\n`;

  const seedDir = path.dirname(seedFile);
  if (!fs.existsSync(seedDir)) {
    fs.mkdirSync(seedDir, { recursive: true });
  }

  fs.writeFileSync(seedFile, sql, 'utf8');
  console.log(`[Phase 2] SQL seed generated at: ${path.relative(projectRoot, seedFile)}`);
}

function main() {
  console.log(`[Phase 2 Importer] Using source file: ${SOURCE_FILE_REL}`);

  const questions = parseReadingPart1(SOURCE_FILE_ABS, 5);
  console.log(`[Phase 2 Importer] Successfully parsed ${questions.length} questions.`);

  ensureMarkersInMarkdown(SOURCE_FILE_ABS, questions);

  const questionsWithHash = questions.map(q => {
    const contentHash = computeCanonicalHash(q);
    return {
      ...q,
      contentHash
    };
  });

  const runId = crypto.randomUUID();
  const startTime = new Date().toISOString();

  updateManifest(MANIFEST_FILE, SOURCE_FILE_REL, questionsWithHash);
  generateSeedSql(SEED_FILE, SOURCE_FILE_REL, questionsWithHash, runId, startTime);
}

main();
