import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SPEAKING_PART4_CORE_STORIES,
  SPEAKING_PART4_MODULE_NAMES,
  getCoreStoryForModule,
  adaptSpeakingPart4Data
} from '../src/adapters/speakingAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Speaking Part 4: 6 Core Stories defined', () => {
  assert.equal(SPEAKING_PART4_CORE_STORIES.length, 6, 'Should have exactly 6 Core Stories');
  SPEAKING_PART4_CORE_STORIES.forEach((cs, i) => {
    assert.ok(cs.key, `Core Story ${i + 1} must have a key`);
    assert.ok(cs.name, `Core Story ${i + 1} must have a name`);
    assert.ok(cs.storyText, `Core Story ${i + 1} must have story text`);
    assert.ok(Array.isArray(cs.moduleKeys), `Core Story ${i + 1} must have module keys array`);
  });
});

test('Speaking Part 4: 58 Modules defined across 6 Core Stories', () => {
  assert.equal(SPEAKING_PART4_MODULE_NAMES.length, 58, 'Should have exactly 58 Modules');
  const totalModuleKeys = SPEAKING_PART4_CORE_STORIES.reduce((acc, cs) => acc + cs.moduleKeys.length, 0);
  assert.equal(totalModuleKeys, 58, 'Sum of moduleKeys across 6 Core Stories must equal 58');

  // Verify unique module keys
  const allKeys = SPEAKING_PART4_CORE_STORIES.flatMap(cs => cs.moduleKeys);
  const uniqueKeys = new Set(allKeys);
  assert.equal(uniqueKeys.size, 58, 'All 58 module keys must be unique');
});

test('Speaking Part 4: 174 logical questions total (3 prompts per Module)', () => {
  // Generate 174 mock questions (58 modules x 3 prompts)
  const mockQuestions = [];
  for (let m = 1; m <= 58; m++) {
    const modKey = `speaking-p4-topic${String(m).padStart(3, '0')}`;
    mockQuestions.push(
      { id: `${modKey}-q1`, source_key: `${modKey}-q1`, content: `Main question for module ${m}`, metadata: { role: 'main', prompt_variants: [`Variant phrasing A for module ${m}`] } },
      { id: `${modKey}-q2`, source_key: `${modKey}-q2`, content: `Subquestion 1 for module ${m}`, metadata: { role: 'subquestion_1' } },
      { id: `${modKey}-q3`, source_key: `${modKey}-q3`, content: `Subquestion 2 for module ${m}`, metadata: { role: 'subquestion_2' } }
    );
  }

  assert.equal(mockQuestions.length, 174, 'Mock questions array should contain exactly 174 questions');

  const adapted = adaptSpeakingPart4Data(mockQuestions);
  assert.equal(adapted.length, 58, 'Full mode should return 58 adapted Modules');

  adapted.forEach((mod, idx) => {
    assert.equal(mod.prompts.length, 3, `Module ${idx + 1} must contain exactly 3 prompts`);
    assert.equal(mod.prompts[0].role, 'main');
    assert.equal(mod.prompts[1].role, 'subquestion_1');
    assert.equal(mod.prompts[2].role, 'subquestion_2');
    assert.ok(mod.coreKey, `Module ${idx + 1} must be linked to a Core Story key`);
  });
});

test('Speaking Part 4: Main Question prompt_variants do not increase logical question count', () => {
  const mockQuestionsWithVariants = [
    { id: 'speaking-p4-topic001-q1', source_key: 'speaking-p4-topic001-q1', content: 'Main Q with variants', metadata: { role: 'main', prompt_variants: ['Var 1', 'Var 2', 'Var 3'] } },
    { id: 'speaking-p4-topic001-q2', source_key: 'speaking-p4-topic001-q2', content: 'Subquestion 1', metadata: { role: 'subquestion_1' } },
    { id: 'speaking-p4-topic001-q3', source_key: 'speaking-p4-topic001-q3', content: 'Subquestion 2', metadata: { role: 'subquestion_2' } }
  ];

  const adapted = adaptSpeakingPart4Data(mockQuestionsWithVariants);
  assert.equal(adapted.length, 1, 'Should adapt into exactly 1 Module record');
  assert.equal(adapted[0].prompts.length, 3, 'Should contain 3 logical prompts');
  assert.equal(adapted[0].prompts[0].variants.length, 3, 'Main prompt variants stored in prompt metadata');
});

test('Speaking Part 4: Core Story mapping and filtering', () => {
  const cs1 = getCoreStoryForModule('speaking-p4-topic001');
  assert.equal(cs1.key, 'speaking-p4-core1', 'Module 001 belongs to Core 1');

  const cs2 = getCoreStoryForModule('speaking-p4-topic017');
  assert.equal(cs2.key, 'speaking-p4-core2', 'Module 017 belongs to Core 2');

  const cs6 = getCoreStoryForModule('speaking-p4-topic058');
  assert.equal(cs6.key, 'speaking-p4-core6', 'Module 058 belongs to Core 6');
});

test('Speaking Part 4: Security check - No private answer query in src/', () => {
  function scanDir(dir) {
    let matches = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        matches = matches.concat(scanDir(fullPath));
      } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('aptis_question_answers')) {
          matches.push(fullPath);
        }
      }
    }
    return matches;
  }

  const srcDir = path.join(rootDir, 'src');
  const violations = scanDir(srcDir);
  assert.deepEqual(violations, [], `No frontend src/ files should reference private table aptis_question_answers. Found in: ${violations.join(', ')}`);
});
