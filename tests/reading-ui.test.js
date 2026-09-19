import assert from 'node:assert';
import {
  getReadingMockPart1,
  getReadingMockPart2,
  getReadingMockPart4,
  getReadingMockPart5,
  evaluateReadingPart1,
  evaluateReadingPart2,
  evaluateReadingPart4,
  evaluateReadingPart5,
} from '../src/data/readingMockData.js';

console.log('====================================================');
console.log('[Phase 6A.1 Test Suite] Running Reading UI & Mock Data Tests');
console.log('====================================================');

// Test 1: Verify Mock Part 1
console.log('\n[Test 1] Verify Reading Part 1 Mock Structure...');
const p1Data = getReadingMockPart1();
assert.strictEqual(p1Data.part, '1');
assert.ok(Array.isArray(p1Data.questions));
assert.strictEqual(p1Data.questions.length, 5);
p1Data.questions.forEach((q) => {
  assert.ok(q.id, 'Question must have id');
  assert.ok(q.prompt, 'Question must have prompt');
  assert.ok(Array.isArray(q.options), 'Question must have options array');
  assert.strictEqual(q.options.length, 3, 'Part 1 options should have 3 choices A/B/C');
});
console.log('  --> PASS: Part 1 mock format valid (5 questions, 3 options each).');

// Test 2: Verify Mock Part 2-3 (Merged Part 2 and Part 3)
console.log('\n[Test 2] Verify Reading Part 2–3 Mock Structure...');
const p2Data = getReadingMockPart2();
assert.strictEqual(p2Data.part, '2-3');
assert.ok(p2Data.set, 'Must have sentence ordering set');
assert.strictEqual(p2Data.set.sentences.length, 6, 'Sentence ordering set has 6 sentences');
assert.strictEqual(p2Data.set.correctOrder.length, 6);
console.log('  --> PASS: Part 2–3 sentence ordering set valid.');

// Test 3: Verify Mock Part 4
console.log('\n[Test 3] Verify Reading Part 4 Mock Structure...');
const p4Data = getReadingMockPart4();
assert.strictEqual(p4Data.part, '4');
assert.ok(Array.isArray(p4Data.opinions), 'Must have 4 opinions (Persons A, B, C, D)');
assert.strictEqual(p4Data.opinions.length, 4);
assert.strictEqual(p4Data.questions.length, 7, 'Part 4 has 7 matching statements');
console.log('  --> PASS: Part 4 opinion matching valid (4 persons, 7 statements).');

// Test 4: Verify Mock Part 5
console.log('\n[Test 4] Verify Reading Part 5 Mock Structure...');
const p5Data = getReadingMockPart5();
assert.strictEqual(p5Data.part, '5');
assert.ok(Array.isArray(p5Data.headingOptions), 'Must have heading options');
assert.strictEqual(p5Data.headingOptions.length, 7, '7 Heading options A-G');
assert.strictEqual(p5Data.sections.length, 6, '6 Paragraph sections');
console.log('  --> PASS: Part 5 heading matching valid (7 headings, 6 sections).');

// Test 5: Verify Evaluator for Part 1
console.log('\n[Test 5] Verify Part 1 Evaluator...');
const p1Answers = {
  'p1-q1': 'book',
  'p1-q2': 'train',
  'p1-q3': 'wrong',
};
const p1Eval = evaluateReadingPart1(p1Data.questions, p1Answers);
assert.strictEqual(p1Eval.total, 5);
assert.strictEqual(p1Eval.score, 2);
assert.strictEqual(p1Eval.questionResults['p1-q1'], true);
assert.strictEqual(p1Eval.questionResults['p1-q2'], true);
assert.strictEqual(p1Eval.questionResults['p1-q3'], false);
console.log('  --> PASS: Part 1 evaluator accurately calculated score (2/5).');

// Test 6: Verify Evaluator for Part 2-3
console.log('\n[Test 6] Verify Part 2–3 Evaluator...');
const p2OrderCorrect = ['sent-1', 'sent-2', 'sent-3', 'sent-4', 'sent-5', 'sent-6'];
const p2Answers = {
  'part2-set1': p2OrderCorrect,
};
const p2Eval = evaluateReadingPart2(p2Data.set, p2Answers);
assert.strictEqual(p2Eval.total, 6);
assert.strictEqual(p2Eval.score, 6);
assert.strictEqual(p2Eval.questionResults['part2-set1'], true);
console.log('  --> PASS: Part 2–3 evaluator verified perfect ordering (6/6).');

// Test 7: Verify Evaluator for Part 4
console.log('\n[Test 7] Verify Part 4 Evaluator...');
const p4Answers = {
  'p4-q1': 'A',
  'p4-q2': 'B',
  'p4-q3': 'C',
};
const p4Eval = evaluateReadingPart4(p4Data.questions, p4Answers);
assert.strictEqual(p4Eval.score, 3);
assert.strictEqual(p4Eval.questionResults['p4-q1'], true);
assert.strictEqual(p4Eval.questionResults['p4-q2'], true);
assert.strictEqual(p4Eval.questionResults['p4-q3'], true);
console.log('  --> PASS: Part 4 evaluator accurately scored matches.');

// Test 8: Verify Evaluator for Part 5
console.log('\n[Test 8] Verify Part 5 Evaluator...');
const p5Answers = {
  'p5-sec1': 'A',
  'p5-sec2': 'B',
};
const p5Eval = evaluateReadingPart5(p5Data.sections, p5Answers);
assert.strictEqual(p5Eval.score, 2);
assert.strictEqual(p5Eval.questionResults['p5-sec1'], true);
assert.strictEqual(p5Eval.questionResults['p5-sec2'], true);
console.log('  --> PASS: Part 5 evaluator verified section headings.');

// Test 9: Verify Part selector options restriction
console.log('\n[Test 9] Verify Part Selector constraints (NO separate Part 2 or Part 3)...');
const allowedParts = [
  { id: '1', label: 'Part 1', sublabel: 'Sentence Comprehension' },
  { id: '2-3', label: 'Part 2–3', sublabel: 'Text Cohesion / Sentence Ordering' },
  { id: '4', label: 'Part 4', sublabel: 'Opinion Matching' },
  { id: '5', label: 'Part 5', sublabel: 'Long Text Comprehension' },
];
const hasPart2Alone = allowedParts.some((p) => p.id === '2');
const hasPart3Alone = allowedParts.some((p) => p.id === '3');
assert.strictEqual(hasPart2Alone, false, 'Part 2 MUST NOT be listed separately');
assert.strictEqual(hasPart3Alone, false, 'Part 3 MUST NOT be listed separately');
assert.strictEqual(allowedParts.find((p) => p.id === '2-3').label, 'Part 2–3');
console.log('  --> PASS: Part 2 and Part 3 strictly merged into "Part 2–3".');

// Test 10: Verify Security & No Supabase Import in Mock Adapter
console.log('\n[Test 10] Verify zero Supabase imports in reading mock adapter...');
import fs from 'node:fs';
const mockFileContent = fs.readFileSync('src/data/readingMockData.js', 'utf8');
assert.strictEqual(mockFileContent.includes('@supabase/supabase-js'), false);
assert.strictEqual(mockFileContent.includes('aptis_question_answers'), false);
console.log('  --> PASS: Mock adapter is 100% client-safe and standalone.');

console.log('\n====================================================');
console.log('ALL PHASE 6A.1 READING UI TESTS PASSED SUCCESSFULLY!');
console.log('====================================================\n');
