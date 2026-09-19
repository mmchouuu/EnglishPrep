import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseFrontMatter, parseIncrementalFragment } from './lib/incremental-parsers.js';
import { validateSourceKey, generateNextSourceKey, extractSourceKeyMarkers, normalizeManifestEntries } from './lib/source-key.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    dryRun: false,
    generateSeed: false,
    approveGeneratedKeys: false,
    groupKey: null,
    manifestFile: null,
    reportsDir: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file' && i + 1 < args.length) {
      options.file = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--generate-seed') {
      options.generateSeed = true;
    } else if (arg === '--approve-generated-keys') {
      options.approveGeneratedKeys = true;
    } else if (arg === '--group-key' && i + 1 < args.length) {
      options.groupKey = args[++i];
    } else if (arg === '--manifest-file' && i + 1 < args.length) {
      options.manifestFile = args[++i];
    } else if (arg === '--reports-dir' && i + 1 < args.length) {
      options.reportsDir = args[++i];
    }
  }

  return options;
}

export async function runIncrementalImport(opts) {
  if (!opts.file) {
    throw new Error(`[Missing Argument] --file "<update-file-path>" is required.`);
  }

  if (opts.dryRun && opts.generateSeed) {
    throw new Error(`[Conflicting Flags] Cannot specify both --dry-run and --generate-seed.`);
  }

  if (!opts.dryRun && !opts.generateSeed) {
    throw new Error(`[Missing Action] Must specify either --dry-run or --generate-seed.`);
  }

  const targetPath = path.isAbsolute(opts.file) ? opts.file : path.join(ROOT_DIR, opts.file);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`[File Not Found] Update file does not exist: ${targetPath}`);
  }

  const rawContent = fs.readFileSync(targetPath, 'utf8');

  // 1. Parse Front Matter
  const { frontMatter, body } = parseFrontMatter(rawContent);
  const skill = frontMatter.skill.toLowerCase();

  // Explicit group_key ONLY comes from front matter group_key or CLI option --group-key
  const explicitGroupKey = frontMatter.group_key || opts.groupKey || null;

  const normalizedPath = targetPath.replace(/\\/g, '/');
  if (normalizedPath.includes('/updates/') && !normalizedPath.includes(`/updates/${skill}/`)) {
    throw new Error(`[Skill Mismatch] Update file path '${opts.file}' does not match front matter skill '${skill}'.`);
  }

  // 2. Load and Normalize Manifest
  const manifestPath = opts.manifestFile
    ? (path.isAbsolute(opts.manifestFile) ? opts.manifestFile : path.join(ROOT_DIR, opts.manifestFile))
    : path.join(ROOT_DIR, 'docs', 'aptis', 'manifests', `${skill}.json`);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[MANIFEST_NOT_FOUND] Required manifest file does not exist: ${manifestPath}`);
  }

  let rawManifest;
  try {
    rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(`[Manifest Read Error] Failed to parse manifest JSON at ${manifestPath}: ${err.message}`);
  }

  const manifestEntries = normalizeManifestEntries(rawManifest);
  const manifestMap = {};
  for (const entry of manifestEntries) {
    manifestMap[entry.source_key] = entry;
  }

  // 3. Build Reserved Keys Set
  const reservedKeys = new Set(manifestEntries.map(e => e.source_key));

  if (rawManifest && typeof rawManifest === 'object') {
    if (Array.isArray(rawManifest.reserved_keys)) {
      rawManifest.reserved_keys.forEach(k => reservedKeys.add(k));
    }
    if (Array.isArray(rawManifest.history_keys)) {
      rawManifest.history_keys.forEach(k => reservedKeys.add(k));
    }
  }

  const fileMarkers = extractSourceKeyMarkers(rawContent);
  for (const m of fileMarkers) {
    reservedKeys.add(m.sourceKey);
  }

  // 4. Parse Fragment (Pass explicitGroupKey)
  const parsedResult = parseIncrementalFragment(skill, body, Array.from(reservedKeys), {
    explicitGroupKey: explicitGroupKey
  });
  const questions = parsedResult.questions;

  if (questions.length === 0) {
    throw new Error(`[Empty Fragment] No valid questions parsed from update file: ${opts.file}`);
  }

  // 5. Source Key Processing & Mode Tracking
  const generatedSourceKeys = [];
  const fileSourceKeys = new Set();
  const conflicts = [...(parsedResult.anomalies || [])];
  let keyGenerationMode = null;

  for (const q of questions) {
    if (!q.sourceKey) {
      // Generate key with explicit group key rule
      const genResult = generateNextSourceKey(skill, q.partNumber, explicitGroupKey, reservedKeys);
      const nextKey = genResult.candidateKey;
      keyGenerationMode = genResult.keyGenerationMode;

      if (reservedKeys.has(nextKey)) {
        throw new Error(`[SOURCE_KEY_COLLISION_RISK] Generated key '${nextKey}' already exists in reservedKeys.`);
      }

      q.sourceKey = nextKey;
      generatedSourceKeys.push(nextKey);
      reservedKeys.add(nextKey);
    }

    const keyValidation = validateSourceKey(q.sourceKey, skill);
    if (!keyValidation.valid) {
      throw new Error(`[Invalid Source Key] ${keyValidation.reason}`);
    }

    if (fileSourceKeys.has(q.sourceKey)) {
      conflicts.push(`Duplicate source_key '${q.sourceKey}' within same update file.`);
      throw new Error(`[Duplicate Source Key] Source key '${q.sourceKey}' appears multiple times in update file.`);
    }
    fileSourceKeys.add(q.sourceKey);
  }

  // 6. Compare against Manifest
  let proposedInserted = 0;
  let proposedUpdated = 0;
  let proposedUnchanged = 0;
  const affectedExistingKeys = [];
  const contentHashes = {};

  for (const q of questions) {
    contentHashes[q.sourceKey] = q.contentHash;
    const existing = manifestMap[q.sourceKey];

    if (!existing) {
      proposedInserted++;
    } else {
      affectedExistingKeys.push(q.sourceKey);
      if (existing.content_hash !== q.contentHash) {
        proposedUpdated++;
      } else {
        proposedUnchanged++;
      }
    }
  }

  if (proposedInserted + proposedUpdated + proposedUnchanged !== questions.length) {
    throw new Error(`[Assertion Error] Sum of inserted (${proposedInserted}), updated (${proposedUpdated}), unchanged (${proposedUnchanged}) does not equal total parsed (${questions.length}).`);
  }

  const runSlug = path.basename(opts.file, path.extname(opts.file));

  // 7. Execute --dry-run Mode
  if (opts.dryRun) {
    const reportsDir = opts.reportsDir
      ? (path.isAbsolute(opts.reportsDir) ? opts.reportsDir : path.join(ROOT_DIR, opts.reportsDir))
      : path.join(ROOT_DIR, 'reports', 'incremental');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, `${runSlug}-dry-run.json`);
    const reportData = {
      source_file: opts.file,
      skill: skill,
      comparison_source: 'manifest',
      key_generation_mode: keyGenerationMode,
      total_parsed: questions.length,
      proposed_inserted: proposedInserted,
      proposed_updated: proposedUpdated,
      proposed_unchanged: proposedUnchanged,
      conflicts: conflicts,
      anomalies: parsedResult.anomalies || [],
      generated_source_keys: generatedSourceKeys,
      affected_existing_keys: affectedExistingKeys,
      content_hashes: contentHashes
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');

    console.log(`====================================================`);
    console.log(`[Phase 4] APTIS Incremental Import Dry-Run Report`);
    console.log(`====================================================`);
    console.log(`  Source File: ${opts.file}`);
    console.log(`  Skill: ${skill}`);
    console.log(`  Comparison Source: manifest`);
    console.log(`  Key Generation Mode: ${keyGenerationMode || 'N/A (All Keys Marked)'}`);
    console.log(`  Total Parsed: ${questions.length}`);
    console.log(`  Proposed Inserted: ${proposedInserted}`);
    console.log(`  Proposed Updated: ${proposedUpdated}`);
    console.log(`  Proposed Unchanged: ${proposedUnchanged}`);
    console.log(`  Generated Keys Count: ${generatedSourceKeys.length}`);
    if (generatedSourceKeys.length > 0) {
      console.log(`  Generated Keys: ${generatedSourceKeys.join(', ')}`);
    }
    console.log(`  Report Saved To: ${reportPath}`);
    console.log(`====================================================`);

    return reportData;
  }

  // 8. Execute --generate-seed Mode
  if (opts.generateSeed) {
    if (conflicts.length > 0) {
      throw new Error(`[Conflicts Detected] Cannot generate seed due to conflicts: ${conflicts.join('; ')}`);
    }

    if (generatedSourceKeys.length > 0 && !opts.approveGeneratedKeys) {
      throw new Error(`[Approval Required] ${generatedSourceKeys.length} source keys were generated (${generatedSourceKeys.join(', ')}). Re-run with --approve-generated-keys or manually add <!-- source_key: ... --> markers in update file.`);
    }

    if (generatedSourceKeys.length > 0 && opts.approveGeneratedKeys) {
      let updatedBody = body;
      for (const q of questions) {
        if (generatedSourceKeys.includes(q.sourceKey)) {
          const markerComment = `<!-- source_key: ${q.sourceKey} -->\n`;
          updatedBody = updatedBody.replace(q.content, `${markerComment}${q.content}`);
        }
      }
      const newFileContent = `---
skill: ${frontMatter.skill}
operation: ${frontMatter.operation || 'upsert'}
source_file: ${opts.file}
---
${updatedBody}`;
      fs.writeFileSync(targetPath, newFileContent, 'utf8');
      console.log(`[Phase 4] Updated source_key markers in ${opts.file}`);
    }

    if (Array.isArray(rawManifest.questions)) {
      for (const q of questions) {
        const idx = rawManifest.questions.findIndex(item => item.source_key === q.sourceKey);
        const entryObj = {
          skill: skill,
          part: q.partNumber,
          group_key: q.groupKey,
          source_key: q.sourceKey,
          current_content_hash: q.contentHash,
          last_imported_at: new Date().toISOString(),
          status: 'active'
        };
        if (idx >= 0) {
          rawManifest.questions[idx] = { ...rawManifest.questions[idx], ...entryObj };
        } else {
          entryObj.initial_content_hash = q.contentHash;
          entryObj.first_created_at = new Date().toISOString();
          rawManifest.questions.push(entryObj);
        }
      }
      rawManifest.total_tracked = rawManifest.questions.length;
      rawManifest.last_updated_at = new Date().toISOString();
      fs.writeFileSync(manifestPath, JSON.stringify(rawManifest, null, 2), 'utf8');
    } else {
      const updatedMap = { ...rawManifest };
      for (const q of questions) {
        updatedMap[q.sourceKey] = {
          content_hash: q.contentHash,
          part_number: q.partNumber,
          question_type: q.questionType,
          updated_at: new Date().toISOString()
        };
      }
      fs.writeFileSync(manifestPath, JSON.stringify(updatedMap, null, 2), 'utf8');
    }

    console.log(`[Phase 4] Updated manifest at ${manifestPath}`);

    const timestampStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const incDir = path.join(ROOT_DIR, 'supabase', 'incremental');
    if (!fs.existsSync(incDir)) {
      fs.mkdirSync(incDir, { recursive: true });
    }

    const sqlFilename = `${timestampStr}_${skill}_${runSlug}.sql`;
    const sqlPath = path.join(incDir, sqlFilename);

    let sqlContent = `-- APTIS Incremental Seed\n`;
    sqlContent += `-- Skill: ${skill}\n`;
    sqlContent += `-- Source File: ${opts.file}\n`;
    sqlContent += `-- Timestamp: ${new Date().toISOString()}\n\n`;
    sqlContent += `BEGIN;\n\n`;

    for (const q of questions) {
      const escapeStr = str => (str ? str.replace(/'/g, "''") : '');
      const contentEsc = escapeStr(q.content);
      const fileEsc = escapeStr(opts.file);
      const uiConfigJson = escapeStr(JSON.stringify(q.uiConfig));
      const metadataJson = escapeStr(JSON.stringify(q.metadata));

      sqlContent += `INSERT INTO public.aptis_questions (\n`;
      sqlContent += `  skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash\n`;
      sqlContent += `) VALUES (\n`;
      sqlContent += `  '${skill}', ${q.partNumber}, '${q.questionType}', '${q.sourceKey}', '${fileEsc}', '${contentEsc}', ${q.displayOrder}, '${uiConfigJson}'::jsonb, '${metadataJson}'::jsonb, '${q.contentHash}'\n`;
      sqlContent += `)\n`;
      sqlContent += `ON CONFLICT (skill, source_key) DO UPDATE SET\n`;
      sqlContent += `  part_number = EXCLUDED.part_number,\n`;
      sqlContent += `  question_type = EXCLUDED.question_type,\n`;
      sqlContent += `  source_file = EXCLUDED.source_file,\n`;
      sqlContent += `  content = EXCLUDED.content,\n`;
      sqlContent += `  display_order = EXCLUDED.display_order,\n`;
      sqlContent += `  ui_config = EXCLUDED.ui_config,\n`;
      sqlContent += `  metadata = EXCLUDED.metadata,\n`;
      sqlContent += `  content_hash = EXCLUDED.content_hash,\n`;
      sqlContent += `  updated_at = NOW()\n`;
      sqlContent += `WHERE aptis_questions.content_hash IS DISTINCT FROM EXCLUDED.content_hash;\n\n`;
    }

    const startedAt = new Date().toISOString();
    const completedAt = new Date().toISOString();

    sqlContent += `INSERT INTO public.aptis_import_runs (\n`;
    sqlContent += `  source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at\n`;
    sqlContent += `) VALUES (\n`;
    sqlContent += `  '${opts.file}', '${skill}', 'COMPLETED', ${questions.length}, ${proposedInserted}, ${proposedUpdated}, ${proposedUnchanged}, 0, '${startedAt}', '${completedAt}'\n`;
    sqlContent += `);\n\n`;

    sqlContent += `COMMIT;\n`;

    fs.writeFileSync(sqlPath, sqlContent, 'utf8');

    console.log(`====================================================`);
    console.log(`[Phase 4] APTIS Incremental Seed Generated`);
    console.log(`====================================================`);
    console.log(`  SQL Seed File: ${sqlPath}`);
    console.log(`  Total Parsed: ${questions.length}`);
    console.log(`  Inserted (Proposed): ${proposedInserted}`);
    console.log(`  Updated (Proposed): ${proposedUpdated}`);
    console.log(`  Unchanged (Proposed): ${proposedUnchanged}`);
    console.log(`====================================================`);

    return {
      sqlPath,
      totalParsed: questions.length,
      proposedInserted,
      proposedUpdated,
      proposedUnchanged
    };
  }
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/import_incremental.js')) {
  const options = parseArgs();
  runIncrementalImport(options).catch(err => {
    console.error(`\n[FATAL ERROR] ${err.message}\n`);
    process.exit(1);
  });
}
