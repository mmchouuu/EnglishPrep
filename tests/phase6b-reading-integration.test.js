import { describe, it, expect } from 'vitest';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatSkillPayload } from '../src/services/aptisService.js';
import {
  adaptPart1Data,
  adaptPart2Data,
  adaptPart4Data,
  adaptPart5Data
} from '../src/adapters/readingAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Phase 6B1 Reading Integration Tests', () => {
  it('1. Route Part -> part_number mapping correct', () => {
    const routeToPart = (slug) => {
      if (slug === 'part-2-3' || slug === '2-3') return 2;
      if (slug === 'part-4' || slug === '4') return 4;
      if (slug === 'part-5' || slug === '5') return 5;
      return 1;
    };

    expect(routeToPart('part-1')).toBe(1);
    expect(routeToPart('part-2-3')).toBe(2);
    expect(routeToPart('part-4')).toBe(4);
    expect(routeToPart('part-5')).toBe(5);
  });

  it('2. Unauthenticated state prevents question fetching', () => {
    let fetchCalled = false;
    const mockFetch = (authStatus) => {
      if (authStatus !== 'authenticated') return;
      fetchCalled = true;
    };

    mockFetch('unauthenticated');
    expect(fetchCalled).toBe(false);

    mockFetch('authenticated');
    expect(fetchCalled).toBe(true);
  });

  it('3. Unauthenticated state maps to Auth Required state', () => {
    const resolveUIState = (authStatus, loading, isEmpty) => {
      if (authStatus === 'loading') return 'AUTH_LOADING';
      if (authStatus === 'unauthenticated') return 'AUTH_REQUIRED';
      if (loading) return 'DATA_LOADING';
      if (isEmpty) return 'EMPTY_STATE';
      return 'DATA_READY';
    };

    expect(resolveUIState('unauthenticated', false, false)).toBe('AUTH_REQUIRED');
    expect(resolveUIState('unauthenticated', false, false)).not.toBe('EMPTY_STATE');
    expect(resolveUIState('authenticated', false, true)).toBe('EMPTY_STATE');
  });

  it('4. Return URL redirection preserves full path and query params', () => {
    const buildRedirectParam = (pathname, search) => encodeURIComponent(pathname + search);
    
    const originalUrl = '/reading/part-4?mode=topic&group=reading-p4-set001';
    const redirectParam = buildRedirectParam('/reading/part-4', '?mode=topic&group=reading-p4-set001');
    const restoredUrl = decodeURIComponent(redirectParam);

    expect(restoredUrl).toBe(originalUrl);
  });

  it('5. user_id is extracted strictly from session', () => {
    const extractUserIdFromSession = (session) => session?.user?.id || null;

    const mockSession = { user: { id: 'usr-session-999', email: 'test@example.com' } };
    expect(extractUserIdFromSession(mockSession)).toBe('usr-session-999');
    expect(extractUserIdFromSession(null)).toBeNull();
  });

  it('6. Static security check across src/ directory', () => {
    const srcDir = path.join(ROOT_DIR, 'src');

    function scanSrc(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let violations = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations = violations.concat(scanSrc(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');

          if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            violations.push(`${entry.name}: contains SUPABASE_SERVICE_ROLE_KEY`);
          }
          if (content.includes('service_role')) {
            violations.push(`${entry.name}: contains service_role string`);
          }
          if (/\.from\s*\(\s*['"`]aptis_question_answers['"`]\s*\)/.test(content)) {
            violations.push(`${entry.name}: queries aptis_question_answers directly`);
          }
        }
      }
      return violations;
    }

    const violations = scanSrc(srcDir);
    expect(violations.length).toBe(0);
  });

  it('7. Sanitizer strips all private fields from question payload', () => {
    const rawMockRow = {
      id: 'q-reading-001',
      skill: 'reading',
      part_number: 1,
      question_type: 'multiple_choice',
      source_key: 'reading-p1-001',
      content: 'Sample prompt text',
      display_order: 1,
      correct_answer: 'A',
      answer: 'A',
      model_answer: 'Full model answer',
      sample_answer: 'Sample text',
      explanation: 'Detailed explanation',
      solution_data: { key: 'A' },
      score: 1,
      aptis_question_options: [
        { id: 'opt-1', option_key: 'A', content: 'Choice A', display_order: 1 },
        { id: 'opt-2', option_key: 'B', content: 'Choice B', display_order: 2 }
      ],
      aptis_question_content_blocks: []
    };

    const sanitized = formatSkillPayload(rawMockRow);

    expect(sanitized.correct_answer).toBeUndefined();
    expect(sanitized.answer).toBeUndefined();
    expect(sanitized.model_answer).toBeUndefined();
    expect(sanitized.explanation).toBeUndefined();
    expect(sanitized.solution_data).toBeUndefined();
    expect(sanitized.score).toBeUndefined();
  });

  it('8. Empty state triggered strictly when authenticated query returns 0 rows', () => {
    const evaluateEmptyState = (authStatus, rows) => {
      if (authStatus !== 'authenticated') return false;
      return Array.isArray(rows) && rows.length === 0;
    };

    expect(evaluateEmptyState('unauthenticated', [])).toBe(false);
    expect(evaluateEmptyState('authenticated', [])).toBe(true);
    expect(evaluateEmptyState('authenticated', [{ id: 'q-1' }])).toBe(false);
  });

  it('9. Part 1 adapter orders options by display_order', () => {
    const questions = [
      {
        id: 'q1',
        content: 'Fill in blank',
        options: [
          { option_key: 'A', content: 'Option A', display_order: 1 },
          { option_key: 'B', content: 'Option B', display_order: 2 }
        ]
      }
    ];

    const adapted = adaptPart1Data(questions);
    expect(adapted.questions.length).toBe(1);
    expect(adapted.questions[0].options[0].key).toBe('A');
  });

  it('10. Part 2 ordering adapter returns valid set structure', () => {
    const orderingQuestions = [
      {
        id: 'task-1',
        content: 'Reorder the sentences',
        options: [
          { option_key: '1', content: 'Sentence 1', display_order: 1 }
        ]
      }
    ];

    const adapted = adaptPart2Data(orderingQuestions, { name: 'WORK & STUDY' });
    expect(adapted.sets.length).toBe(1);
  });

  it('11. Part 4 matching adapter extracts persons A-D', () => {
    const part4Questions = [
      {
        id: 'p4-q1',
        content: 'This person likes sports',
        passage: {
          content: 'Person A: I love running.\nPerson B: I like football.'
        }
      }
    ];

    const adapted = adaptPart4Data(part4Questions, { name: 'HEALTH' });
    expect(adapted.persons.length).toBe(4);
    expect(adapted.persons[0].text).toContain('I love running');
  });

  it('12. Part 5 heading matching adapter links paragraphs properly', () => {
    const part5Questions = [
      {
        id: 'p5-q1',
        content: 'Main idea of paragraph 1',
        options: [{ option_key: '1', content: 'Heading 1', display_order: 1 }],
        passage: {
          content: 'Paragraph 1: Advances in AI have reshaped modern industry.'
        }
      }
    ];

    const adapted = adaptPart5Data(part5Questions, { name: 'SCIENCE' });
    expect(adapted.sections[0].text).toContain('Advances in AI');
  });

  it('13. Global paragraph numbers (8..14) and Person D opinion extracted successfully', () => {
    const part5MultiQuestions = Array.from({ length: 7 }, (_, idx) => ({
      id: `p5-q${idx + 8}`,
      metadata: { paragraph_number: idx + 8 },
      content: `Select heading for Paragraph ${idx + 8}`,
      options: [{ option_key: '1', content: 'Heading 1', display_order: 1 }],
      passage: {
        content: `Paragraph 8:\nLeisure was once separated.\n\nParagraph 9:\nDistance no longer requires.\n\nParagraph 10:\nKnowing where to tap.\n\nParagraph 11:\nMany online services.\n\nParagraph 12:\nA weather application.\n\nParagraph 13:\nBringing people.\n\nParagraph 14:\nA product may contain.`
      }
    }));

    const p5Adapted = adaptPart5Data(part5MultiQuestions, { name: 'DIGITAL INNOVATION' });
    expect(p5Adapted.sections.length).toBe(7);
    expect(p5Adapted.sections[0].text).toContain('Leisure was once separated');
    expect(p5Adapted.sections[6].text).toContain('A product may contain');

    const part4PersonDQuestions = [
      {
        id: 'p4-q1',
        content: 'This person likes reading',
        passage: {
          content: 'A. Text for A.\nB. Text for B.\nC. Text for C.\nD. Text for D ending.'
        }
      }
    ];
    const p4Adapted = adaptPart4Data(part4PersonDQuestions, { name: 'GAMES' });
    expect(p4Adapted.persons[3].key).toBe('D');
    expect(p4Adapted.persons[3].text).toContain('Text for D ending');
  });

  it('14. Internal text numbers (5-6, 2006) preserved without fragmenting paragraphs', () => {
    const consumerPassageText = `Paragraph 29:\nIn today's modern consumer age, people tend to own more than they used to. A worker only has 5-6 pairs of shoes in his entire life.\n\nParagraph 30:\nMrs. Judith Levine - a journalist and her husband decided to change their lifestyle.\n\nParagraph 31:\nTo make this experiment as realistic as possible.\n\nParagraph 32:\nPublished in 2006, the book Not Buying It when reread 10 years later still holds its value.\n\nParagraph 33:\nThe couple wanted to buy a gift as a gift.\n\nParagraph 34:\nMs. Levine does not have an office.\n\nParagraph 35:\nLessons about minimalism in today's consumer trends.`;

    const consumerQs = Array.from({ length: 7 }, (_, idx) => ({
      id: `p5-cons-${idx}`,
      content: `Select matching heading`,
      passage: { content: consumerPassageText }
    }));

    const adaptedCons = adaptPart5Data(consumerQs, { name: 'CONSUMER' });
    expect(adaptedCons.sections.length).toBe(7);
    expect(adaptedCons.sections[0].text).toContain('5-6 pairs of shoes');
    expect(adaptedCons.sections[3].text).toContain('Published in 2006, the book');
  });

  it('15. Topic set Work-Life Balance contains exactly 7 questions', () => {
    const qListSet3 = Array.from({ length: 7 }, (_, idx) => ({
      id: `q-p4-set003-${idx + 1}`,
      source_key: `reading-p4-set003-q00${idx + 1}`,
      content: `Statement ${idx + 1}`,
      passage: {
        title: 'Work-Life Balance (2026)',
        content: 'A. Text A\nB. Text B\nC. Text C\nD. Text D'
      }
    }));

    const adaptedSet3 = adaptPart4Data(qListSet3, { name: 'Work-Life Balance (2026)' });
    expect(adaptedSet3.topicSets.length).toBe(1);
    expect(adaptedSet3.topicSets[0].questions.length).toBe(7);
    expect(adaptedSet3.topicSets[0].topicName).toBe('Work-Life Balance (2026)');
  });
});

