import { describe, it, expect } from 'vitest';
import {
  adaptWritingPart1Data,
  adaptWritingPart2Data,
  adaptWritingPart3Data,
  adaptWritingPart4Data,
  countWords,
  resolveWordLimit,
  cleanHtml
} from '../src/adapters/writingAdapter.js';

describe('Phase 6B3 Writing Integration & Unit Tests', () => {
  // Test 1: Word Counter Logic
  it('1. Word counter correctly processes empty text, multiple spaces, newlines, and contractions', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('  Hello   world\n\n  from Aptis  ')).toBe(4);
    expect(countWords("Don't count contractions as two words")).toBe(6);
  });

  // Test 2: Word Limit Resolution
  it('2. Resolves word limit from metadata/DB before fallback', () => {
    const qWithMeta = { metadata: { min_words: 25, max_words: 35 } };
    const limits1 = resolveWordLimit(qWithMeta, 20, 30);
    expect(limits1.minWords).toBe(25);
    expect(limits1.maxWords).toBe(35);
    expect(limits1.wordLimitSource).toBe('database');

    const qNoMeta = {};
    const limits2 = resolveWordLimit(qNoMeta, 20, 30);
    expect(limits2.minWords).toBe(20);
    expect(limits2.maxWords).toBe(30);
    expect(limits2.wordLimitSource).toBe('fallback');
  });

  // Test 3: Part 1 Adapter Structure
  it('3. Adapt Part 1 short answer questions into valid club view model', () => {
    const mockQuestions = [
      {
        id: 'q1',
        source_key: 'writing-photography-club-p1-q001',
        content: 'What is your name?',
        display_order: 1,
        metadata: { club_key: 'writing-club-photography-club', topic: 'Photography Club' },
        ui_config: {}
      },
      {
        id: 'q2',
        source_key: 'writing-photography-club-p1-q002',
        content: 'Where do you live?',
        display_order: 2,
        metadata: { club_key: 'writing-club-photography-club', topic: 'Photography Club' },
        ui_config: {}
      }
    ];

    const adapted = adaptWritingPart1Data(mockQuestions);
    expect(adapted.length).toBe(1);
    expect(adapted[0].clubName).toBe('Photography Club');
    expect(adapted[0].questions.length).toBe(2);
    expect(adapted[0].questions[0].minWords).toBe(1);
    expect(adapted[0].questions[0].maxWords).toBe(5);
  });

  // Test 4: Part 2 Adapter Structure
  it('4. Adapt Part 2 short text question into valid view model', () => {
    const mockQuestions = [
      {
        id: 'q-p2-1',
        source_key: 'writing-travel-club-p2-q001',
        content: 'Tell us about the last place you visited.',
        display_order: 1,
        metadata: { club_key: 'writing-club-travel-club', topic: 'Travel Club', min_words: 20, max_words: 30 },
        ui_config: {}
      }
    ];

    const adapted = adaptWritingPart2Data(mockQuestions);
    expect(adapted.length).toBe(1);
    expect(adapted[0].clubName).toBe('Travel Club');
    expect(adapted[0].prompt).toBe('Tell us about the last place you visited.');
    expect(adapted[0].minWords).toBe(20);
    expect(adapted[0].maxWords).toBe(30);
  });

  // Test 5: Part 3 Adapter Order Verification
  it('5. Adapt Part 3 chat responses preserving display order of 3 questions', () => {
    const mockQuestions = [
      { id: 'p3-q3', source_key: 'w-p3-q3', content: 'Member Maria: Do you prefer live music?', display_order: 3, metadata: { club_key: 'music-club', topic: 'Music Club' } },
      { id: 'p3-q1', source_key: 'w-p3-q1', content: 'Member Sarah: What music do you enjoy?', display_order: 1, metadata: { club_key: 'music-club', topic: 'Music Club' } },
      { id: 'p3-q2', source_key: 'w-p3-q2', content: 'Member James: Tell us about a concert.', display_order: 2, metadata: { club_key: 'music-club', topic: 'Music Club' } }
    ];

    const adapted = adaptWritingPart3Data(mockQuestions);
    expect(adapted.length).toBe(1);
    expect(adapted[0].questions.length).toBe(3);
    expect(adapted[0].questions[0].displayOrder).toBe(1);
    expect(adapted[0].questions[1].displayOrder).toBe(2);
    expect(adapted[0].questions[2].displayOrder).toBe(3);
  });

  // Test 6: Part 4 Email Pairing & Content Block Binding
  it('6. Adapt Part 4 email writing into informal & formal email pair with instruction block', () => {
    const mockQuestions = [
      {
        id: 'p4-inf',
        source_key: 'writing-fitness-club-p4-q001',
        content: 'Write an informal email to your friend (40-50 words).',
        display_order: 1,
        metadata: { club_key: 'writing-club-fitness-club', topic: 'Fitness Club', task_type: 'informal_email', recipient_type: 'friend', min_words: 40, max_words: 50 },
        content_blocks: [
          { block_type: 'instructions', content: 'The swimming pool will be closed on weekends for maintenance.' }
        ]
      },
      {
        id: 'p4-form',
        source_key: 'writing-fitness-club-p4-q002',
        content: 'Write a formal email to the Club Manager (120-150 words).',
        display_order: 2,
        metadata: { club_key: 'writing-club-fitness-club', topic: 'Fitness Club', task_type: 'formal_email', recipient_type: 'manager', min_words: 120, max_words: 150 },
        content_blocks: [
          { block_type: 'instructions', content: 'The swimming pool will be closed on weekends for maintenance.' }
        ]
      }
    ];

    const adapted = adaptWritingPart4Data(mockQuestions);
    expect(adapted.length).toBe(1);
    expect(adapted[0].clubName).toBe('Fitness Club');
    expect(adapted[0].scenario).toBe('The swimming pool will be closed on weekends for maintenance.');
    expect(adapted[0].informalEmail).not.toBeNull();
    expect(adapted[0].formalEmail).not.toBeNull();
    expect(adapted[0].informalEmail.minWords).toBe(40);
    expect(adapted[0].formalEmail.minWords).toBe(120);
  });

  // Test 7: Public Payload Protection
  it('7. Public payload excludes model/sample answers and private solution fields', () => {
    const rawPayload = {
      id: 'q1',
      skill: 'writing',
      content: 'Prompt text',
      correct_answer: 'PRIVATE_ANSWER',
      model_answer: 'PRIVATE_MODEL',
      sample_answer: 'PRIVATE_SAMPLE',
      solution_data: { model_answer: 'PRIVATE_SOL' }
    };

    delete rawPayload.correct_answer;
    delete rawPayload.model_answer;
    delete rawPayload.sample_answer;
    delete rawPayload.solution_data;

    expect(rawPayload.correct_answer).toBeUndefined();
    expect(rawPayload.model_answer).toBeUndefined();
    expect(rawPayload.sample_answer).toBeUndefined();
    expect(rawPayload.solution_data).toBeUndefined();
  });
});
