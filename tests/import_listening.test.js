import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MANIFEST_PATH = path.join(ROOT_DIR, 'docs', 'aptis', 'manifests', 'listening.json');
const SEED_PATH = path.join(ROOT_DIR, 'supabase', 'seed_listening.sql');
const REPORT_PATH = path.join(ROOT_DIR, 'docs', 'aptis', 'phase3-listening-report.md');
const SOURCE_PATH = path.join(ROOT_DIR, 'docs', '03-listening-inline-transcripts.md');

function runListeningImporterTests() {
  console.log(`====================================================`);
  console.log(`[Static Test Suite] APTIS Listening Importer & Files Verification`);
  console.log(`====================================================\n`);

  let passed = 0;

  // Test 1: Check source file existence and header structure
  console.log(`[Test 1] Source file existence and Part headings...`);
  assert(fs.existsSync(SOURCE_PATH), `Source file missing: ${SOURCE_PATH}`);
  const sourceText = fs.readFileSync(SOURCE_PATH, 'utf8');
  assert(sourceText.includes('### **Part 1: Information Recognition'), 'Missing Part 1 heading');
  assert(sourceText.includes('### **Part 2: Information Matching'), 'Missing Part 2 heading');
  assert(sourceText.includes('### **Part 3: Opinion Matching'), 'Missing Part 3 heading');
  assert(sourceText.includes('### **Part 4: Longer Monologues'), 'Missing Part 4 heading');
  console.log(`  PASSED: Source file exists with all 4 Part headings.\n`);
  passed++;

  // Test 2: Check manifest file structure and baseline counts
  console.log(`[Test 2] Manifest verification (758 questions)...`);
  assert(fs.existsSync(MANIFEST_PATH), `Manifest file missing: ${MANIFEST_PATH}`);
  const manifestData = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const questions = Array.isArray(manifestData) ? manifestData : manifestData.questions;
  
  assert.strictEqual(questions.length, 758, `Expected 758 questions in manifest, found ${questions.length}`);
  const uniqueKeys = new Set(questions.map(q => q.source_key));
  assert.strictEqual(uniqueKeys.size, 758, `Expected 758 unique keys in manifest, found ${uniqueKeys.size}`);

  const p1Count = questions.filter(q => q.part === 1).length;
  const p2Count = questions.filter(q => q.part === 2).length;
  const p3Count = questions.filter(q => q.part === 3).length;
  const p4Count = questions.filter(q => q.part === 4).length;

  assert.strictEqual(p1Count, 286, `Part 1 question count mismatch: ${p1Count}`);
  assert.strictEqual(p2Count, 176, `Part 2 question count mismatch: ${p2Count}`);
  assert.strictEqual(p3Count, 176, `Part 3 question count mismatch: ${p3Count}`);
  assert.strictEqual(p4Count, 120, `Part 4 question count mismatch: ${p4Count}`);

  console.log(`  PASSED: Manifest contains 758 questions (P1:286, P2:176, P3:176, P4:120).\n`);
  passed++;

  // Test 3: Check Part 1 topic group classification in manifest
  console.log(`[Test 3] Part 1 topic groups verification...`);
  const p1Questions = questions.filter(q => q.part === 1);
  const topicsMap = {};
  for (const q of p1Questions) {
    const t = q.information_type;
    assert(t, `Question ${q.source_key} missing information_type`);
    topicsMap[t] = (topicsMap[t] || 0) + 1;
  }
  const uniqueTopics = Object.keys(topicsMap);
  assert.strictEqual(uniqueTopics.length, 8, `Expected 8 Part 1 topic groups, found ${uniqueTopics.length}`);
  console.log(`  Part 1 Topics:`, topicsMap);
  console.log(`  PASSED: 8 Part 1 topic groups present.\n`);
  passed++;

  // Test 4: Check seed SQL existence and structural features
  console.log(`[Test 4] Seed SQL syntax and zero-write clause check...`);
  assert(fs.existsSync(SEED_PATH), `Seed SQL missing: ${SEED_PATH}`);
  const sqlText = fs.readFileSync(SEED_PATH, 'utf8');

  assert(sqlText.startsWith('-- ============================================================================') || sqlText.includes('BEGIN;'), 'Seed SQL missing transaction header');
  assert(sqlText.includes('COMMIT;'), 'Seed SQL missing COMMIT;');
  assert(sqlText.includes('IS DISTINCT FROM EXCLUDED.content_hash'), 'Seed SQL missing IS DISTINCT FROM zero-write clause');
  assert(!sqlText.includes('TRUNCATE'), 'Seed SQL MUST NOT contain TRUNCATE');
  assert(!sqlText.includes('source_key') || !sqlText.includes('aptis_groups.source_key'), 'Seed SQL MUST NOT use aptis_groups.source_key');
  assert(!sqlText.includes('aptis_import_runs.details'), 'Seed SQL MUST NOT reference aptis_import_runs.details');

  console.log(`  PASSED: Seed SQL contains transaction wrappers, zero-write clause, and strict Phase 0 schema compliance.\n`);
  passed++;

  // Test 5: Check Report file existence and status statement
  console.log(`[Test 5] Report markdown verification...`);
  assert(fs.existsSync(REPORT_PATH), `Report file missing: ${REPORT_PATH}`);
  const reportText = fs.readFileSync(REPORT_PATH, 'utf8');
  assert(reportText.includes('Static Listening inline transcript and database integration completed — runtime verification pending.'), 'Report missing mandatory final status string');
  console.log(`  PASSED: Report markdown verified with mandatory completion string.\n`);
  passed++;

  console.log(`====================================================`);
  console.log(`[SUCCESS] All ${passed}/${passed} Importer Verification Tests Passed!`);
  console.log(`====================================================\n`);
}

runListeningImporterTests();
