import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runIncrementalImport } from '../scripts/import_incremental.js';
import { computeCanonicalQuestionHash } from '../scripts/lib/canonical-hash.js';
import { normalizeManifestEntries, generateNextSourceKey } from '../scripts/lib/source-key.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const TEMP_DIR = path.join(ROOT_DIR, 'tests', 'temp_incremental');
const TEMP_MANIFEST_DIR = path.join(TEMP_DIR, 'manifests');
const TEMP_REPORTS_DIR = path.join(TEMP_DIR, 'reports');

function setupTemp() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_MANIFEST_DIR)) {
    fs.mkdirSync(TEMP_MANIFEST_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_REPORTS_DIR)) {
    fs.mkdirSync(TEMP_REPORTS_DIR, { recursive: true });
  }

  // Create isolated production-like test manifest with set001 and set029
  const testManifestPath = path.join(TEMP_MANIFEST_DIR, 'reading.json');
  const mockManifest = {
    skill: 'reading',
    total_parsed: 3,
    questions: [
      { source_key: 'reading-p1-set001-q001', current_content_hash: 'hash1', part: 1, group_key: 'reading-p1-set001' },
      { source_key: 'reading-p1-set001-q002', current_content_hash: 'hash2', part: 1, group_key: 'reading-p1-set001' },
      { source_key: 'reading-p1-set029-q001', current_content_hash: 'hash3', part: 1, group_key: 'reading-p1-set029' }
    ]
  };

  fs.writeFileSync(testManifestPath, JSON.stringify(mockManifest, null, 2), 'utf8');
}

function cleanupTemp() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

async function runAllTests() {
  console.log(`====================================================`);
  console.log(`[Phase 4 Test Suite] Running Incremental Import Tests`);
  console.log(`====================================================\n`);

  setupTemp();
  let passedCount = 0;
  const testManifestFile = path.join('tests', 'temp_incremental', 'manifests', 'reading.json');
  const testReportsDir = path.join('tests', 'temp_incremental', 'reports');

  try {
    // ------------------------------------------------------------------------
    // Test 1: Add 1 new question without group_key (Mode: "new_set", Key: reading-p1-set030-q001)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 1] Add 1 new question without group_key...`);
      const fixturePath = 'tests/fixtures/incremental/reading-new-question.md';
      const result = await runIncrementalImport({
        file: fixturePath,
        dryRun: true,
        manifestFile: testManifestFile,
        reportsDir: testReportsDir
      });

      const actualKey = result.generated_source_keys[0];
      const expectedKey = 'reading-p1-set030-q001';

      if (actualKey !== expectedKey) {
        console.error(`\nExpected: ${expectedKey}`);
        console.error(`Actual: ${actualKey}\n`);
      }

      assert.strictEqual(result.total_parsed, 1, `Expected total_parsed = 1, got ${result.total_parsed}`);
      assert.strictEqual(result.proposed_inserted, 1, `Expected proposed_inserted = 1, got ${result.proposed_inserted}`);
      assert.strictEqual(result.key_generation_mode, 'new_set', `Expected key_generation_mode = new_set, got ${result.key_generation_mode}`);
      assert.strictEqual(actualKey, expectedKey, `Expected: ${expectedKey}\nActual: ${actualKey}`);

      console.log(`  PASSED: totalParsed=1, inserted=1, mode=new_set, generatedKey=${actualKey}\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test Existing Group: Front matter has explicit group_key: reading-p1-set001 (Mode: "existing_group", Key: reading-p1-set001-q003)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test Existing Group] Add question with explicit group_key: reading-p1-set001...`);
      const tempFile = path.join(TEMP_DIR, 'reading-existing-group.md');
      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
group_key: reading-p1-set001
source_file: tests/temp_incremental/reading-existing-group.md
---

### Part 1: Additional item for set001
| Question | Answer |
| --- | --- |
| Question for set001 | Answer for set001 |
`, 'utf8');

      const result = await runIncrementalImport({
        file: 'tests/temp_incremental/reading-existing-group.md',
        dryRun: true,
        manifestFile: testManifestFile,
        reportsDir: testReportsDir
      });

      const actualKey = result.generated_source_keys[0];
      const expectedKey = 'reading-p1-set001-q003';

      if (actualKey !== expectedKey) {
        console.error(`\nExpected: ${expectedKey}`);
        console.error(`Actual: ${actualKey}\n`);
      }

      assert.strictEqual(result.total_parsed, 1);
      assert.strictEqual(result.key_generation_mode, 'existing_group', `Expected key_generation_mode = existing_group, got ${result.key_generation_mode}`);
      assert.strictEqual(actualKey, expectedKey, `Expected: ${expectedKey}\nActual: ${actualKey}`);

      console.log(`  PASSED: totalParsed=1, mode=existing_group, generatedKey=${actualKey}\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 2: Re-run same existing question (inserted = 0, updated = 0, unchanged = 1)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 2] Re-run same existing question file...`);
      const tempFile = path.join(TEMP_DIR, 'reading-existing.md');
      
      const qObj = {
        skill: 'reading',
        partNumber: 1,
        questionType: 'multiple_choice',
        content: 'Existing question content',
        options: [{ content: 'Existing answer', displayOrder: 1, optionKey: 'opt_1' }],
        correctAnswer: 'opt_1',
        metadata: { part_number: 1, section_name: 'Part 1' },
        uiConfig: { input_type: 'radio', autosave: true }
      };
      const exactHash = computeCanonicalQuestionHash(qObj);

      const manifestPath = path.join(ROOT_DIR, testManifestFile);
      const manifestObj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifestObj.questions.push({
        source_key: 'reading-p1-set001-q005',
        current_content_hash: exactHash,
        part: 1,
        group_key: 'reading-p1-set001'
      });
      fs.writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2), 'utf8');

      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
source_file: tests/temp_incremental/reading-existing.md
---

### Part 1: Existing
<!-- source_key: reading-p1-set001-q005 -->
| Question | Answer |
| --- | --- |
| Existing question content | Existing answer |
`, 'utf8');

      const result = await runIncrementalImport({
        file: 'tests/temp_incremental/reading-existing.md',
        dryRun: true,
        manifestFile: testManifestFile,
        reportsDir: testReportsDir
      });

      assert.strictEqual(result.total_parsed, 1);
      assert.strictEqual(result.proposed_inserted, 0);
      assert.strictEqual(result.proposed_updated, 0);
      assert.strictEqual(result.proposed_unchanged, 1);

      console.log(`  PASSED: total=1, inserted=0, updated=0, unchanged=1\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 3: Sửa nội dung cùng source_key (inserted = 0, updated = 1)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 3] Update question content with existing source_key...`);
      const tempFile = path.join(TEMP_DIR, 'reading-update.md');
      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
source_file: tests/temp_incremental/reading-update.md
---

### Part 1: Update
<!-- source_key: reading-p1-set001-q001 -->
| Question | Answer |
| --- | --- |
| MODIFIED question text | MODIFIED answer |
`, 'utf8');

      const result = await runIncrementalImport({
        file: 'tests/temp_incremental/reading-update.md',
        dryRun: true,
        manifestFile: testManifestFile,
        reportsDir: testReportsDir
      });

      assert.strictEqual(result.total_parsed, 1);
      assert.strictEqual(result.proposed_inserted, 0);
      assert.strictEqual(result.proposed_updated, 1);
      assert.strictEqual(result.proposed_unchanged, 0);

      console.log(`  PASSED: total=1, inserted=0, updated=1, unchanged=0\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 4: Hai record (một mới + một không đổi)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 4] Two records: 1 new + 1 unchanged...`);
      const tempFile = path.join(TEMP_DIR, 'reading-mixed.md');
      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
source_file: tests/temp_incremental/reading-mixed.md
---

### Part 1: Unchanged
<!-- source_key: reading-p1-set001-q005 -->
| Question | Answer |
| --- | --- |
| Existing question content | Existing answer |

### Part 1: Brand New
<!-- source_key: reading-p1-set999-q999 -->
| Question | Answer |
| --- | --- |
| Brand new question text | Brand new answer text |
`, 'utf8');

      const result = await runIncrementalImport({
        file: 'tests/temp_incremental/reading-mixed.md',
        dryRun: true,
        manifestFile: testManifestFile,
        reportsDir: testReportsDir
      });

      assert.strictEqual(result.total_parsed, 2);
      assert.strictEqual(result.proposed_inserted, 1);
      assert.strictEqual(result.proposed_updated, 0);
      assert.strictEqual(result.proposed_unchanged, 1);

      console.log(`  PASSED: total=2, inserted=1, unchanged=1\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 5: Trùng source_key trong cùng file (phải fail)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 5] Duplicate source_key in same file (must fail)...`);
      const tempFile = path.join(TEMP_DIR, 'duplicate-key.md');
      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
source_file: tests/temp_incremental/duplicate-key.md
---

### Question 1
<!-- source_key: reading-p1-dup001 -->
| Question A | Answer A |

### Question 2
<!-- source_key: reading-p1-dup001 -->
| Question B | Answer B |
`, 'utf8');

      let errorThrown = false;
      try {
        await runIncrementalImport({
          file: 'tests/temp_incremental/duplicate-key.md',
          dryRun: true,
          manifestFile: testManifestFile,
          reportsDir: testReportsDir
        });
      } catch (err) {
        errorThrown = true;
        assert(err.message.includes('Duplicate Source Key'));
      }
      assert.strictEqual(errorThrown, true);

      console.log(`  PASSED: Caught duplicate source_key error as expected\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 6: Prefix skill sai (phải fail)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 6] Wrong skill prefix (must fail)...`);
      const tempFile = path.join(TEMP_DIR, 'wrong-prefix.md');
      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
source_file: tests/temp_incremental/wrong-prefix.md
---

### Question 1
<!-- source_key: listening-p1-q001 -->
| Question | Answer |
| --- | --- |
| Sample text | Sample answer |
`, 'utf8');

      let errorThrown = false;
      try {
        await runIncrementalImport({
          file: 'tests/temp_incremental/wrong-prefix.md',
          dryRun: true,
          manifestFile: testManifestFile,
          reportsDir: testReportsDir
        });
      } catch (err) {
        errorThrown = true;
        assert(err.message.includes('does not match expected skill prefix'));
      }
      assert.strictEqual(errorThrown, true);

      console.log(`  PASSED: Caught wrong prefix error as expected\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 7: Thiếu marker (dry-run đề xuất key; chưa approve thì generate-seed fail)
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 7] Missing marker approval check...`);
      const tempFile = path.join(TEMP_DIR, 'missing-marker.md');
      fs.writeFileSync(tempFile, `---
skill: reading
operation: upsert
source_file: tests/temp_incremental/missing-marker.md
---

### Question 1
| Question without marker | Answer |
| --- | --- |
| Sample question text | Sample answer |
`, 'utf8');

      const dryRes = await runIncrementalImport({
        file: 'tests/temp_incremental/missing-marker.md',
        dryRun: true,
        manifestFile: testManifestFile,
        reportsDir: testReportsDir
      });
      assert(dryRes.generated_source_keys.length > 0);

      let errorThrown = false;
      try {
        await runIncrementalImport({
          file: 'tests/temp_incremental/missing-marker.md',
          generateSeed: true,
          manifestFile: testManifestFile,
          reportsDir: testReportsDir
        });
      } catch (err) {
        errorThrown = true;
        assert(err.message.includes('Approval Required'));
      }
      assert.strictEqual(errorThrown, true);

      console.log(`  PASSED: Dry-run proposed key, seed failed without approval flag\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 8: Manifest missing error check
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 8] Non-existent manifest file (must throw MANIFEST_NOT_FOUND)...`);
      let errorThrown = false;
      try {
        await runIncrementalImport({
          file: 'tests/fixtures/incremental/reading-new-question.md',
          dryRun: true,
          manifestFile: 'tests/temp_incremental/non-existent-manifest.json',
          reportsDir: testReportsDir
        });
      } catch (err) {
        errorThrown = true;
        assert(err.message.includes('MANIFEST_NOT_FOUND'));
      }
      assert.strictEqual(errorThrown, true);

      console.log(`  PASSED: Non-existent manifest file threw MANIFEST_NOT_FOUND as expected\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 9: Direct Source Key Generator Dependency Injection Verification
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 9] Direct Source Key Generator Dependency Injection Verification...`);
      const manifestPath = path.join(ROOT_DIR, testManifestFile);
      const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const entries = normalizeManifestEntries(rawManifest);
      const reservedKeys = new Set(entries.map(e => e.source_key));

      assert(reservedKeys.size > 0, `reservedKeys.size must be > 0, got ${reservedKeys.size}`);

      let maxSet = 0;
      for (const k of reservedKeys) {
        const m = /reading-.*p1-set(\d+)/i.exec(k) || /reading-p1-set(\d+)/i.exec(k);
        if (m) {
          const s = parseInt(m[1], 10);
          if (s > maxSet) maxSet = s;
        }
      }
      assert.strictEqual(maxSet, 29, `Expected maxSet = 29, got ${maxSet}`);

      const genRes = generateNextSourceKey('reading', 1, null, reservedKeys);
      assert.strictEqual(genRes.keyGenerationMode, 'new_set');
      assert.strictEqual(genRes.candidateKey, 'reading-p1-set030-q001', `Expected candidate reading-p1-set030-q001, got ${genRes.candidateKey}`);
      assert(!reservedKeys.has(genRes.candidateKey), `Generated key ${genRes.candidateKey} must not be in reservedKeys prior to reservation`);

      reservedKeys.add(genRes.candidateKey);
      assert(reservedKeys.has(genRes.candidateKey), `reservedKeys must contain generatedKey after reservation`);

      console.log(`  PASSED: reservedKeys.size=${reservedKeys.size}, maxSet=29, mode=new_set, candidateKey=reading-p1-set030-q001\n`);
      passedCount++;
    }

    // ------------------------------------------------------------------------
    // Test 10: Manifest normalization format support
    // ------------------------------------------------------------------------
    {
      console.log(`[Test 10] Manifest normalization format support...`);
      
      const fmt1 = { questions: [{ source_key: 'reading-p1-set001-q001' }] };
      const res1 = normalizeManifestEntries(fmt1);
      assert.strictEqual(res1.length, 1);
      assert.strictEqual(res1[0].source_key, 'reading-p1-set001-q001');

      const fmt2 = [{ source_key: 'reading-p1-set001-q002' }];
      const res2 = normalizeManifestEntries(fmt2);
      assert.strictEqual(res2.length, 1);
      assert.strictEqual(res2[0].source_key, 'reading-p1-set001-q002');

      const fmt3 = { 'reading-p1-set001-q003': { content_hash: 'abc' } };
      const res3 = normalizeManifestEntries(fmt3);
      assert.strictEqual(res3.length, 1);
      assert.strictEqual(res3[0].source_key, 'reading-p1-set001-q003');

      console.log(`  PASSED: All 3 manifest formats normalized cleanly\n`);
      passedCount++;
    }

    console.log(`====================================================`);
    console.log(`[SUCCESS] All ${passedCount}/11 Test Cases Passed!`);
    console.log(`====================================================`);

  } finally {
    cleanupTemp();
  }
}

runAllTests().catch(err => {
  console.error(`\n[TEST SUITE FAILURE] ${err.stack}\n`);
  process.exit(1);
});
