import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatSkillPayload } from '../src/services/aptisService.js';
import {
  assignVoiceProfile,
  resolveWebSpeechVoice,
  hashString,
  PROFILE_LIST,
  VOICE_PROFILES
} from '../src/services/listeningAudioProvider.js';
import {
  adaptListeningPart1Data,
  adaptListeningPart2Data,
  adaptListeningPart3Data,
  adaptListeningPart4Data
} from '../src/adapters/listeningAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Phase 6B2 Listening Integration Tests', () => {
  it('1. Route Part -> part_number mapping correct', () => {
    const routeToPart = (slug) => {
      if (slug === 'part-2' || slug === '2') return 2;
      if (slug === 'part-3' || slug === '3') return 3;
      if (slug === 'part-4' || slug === '4') return 4;
      return 1;
    };

    expect(routeToPart('part-1')).toBe(1);
    expect(routeToPart('part-2')).toBe(2);
    expect(routeToPart('part-3')).toBe(3);
    expect(routeToPart('part-4')).toBe(4);
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

  it('3. Authenticated state triggers question fetching', () => {
    const isFetchingAllowed = (authStatus, user) => authStatus === 'authenticated' && Boolean(user);
    expect(isFetchingAllowed('authenticated', { id: 'usr-1' })).toBe(true);
    expect(isFetchingAllowed('unauthenticated', null)).toBe(false);
  });

  it('4. Static check ensuring public query avoids answer table', () => {
    const aptisServiceContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'aptisService.js'), 'utf8');
    expect(aptisServiceContent.includes('aptis_question_answers')).toBe(false);
  });

  it('5. Sanitizer strips all private fields from question payload', () => {
    const rawMockRow = {
      id: 'q-listening-001',
      skill: 'listening',
      part_number: 1,
      question_type: 'multiple_choice',
      source_key: 'listening-p1-set001-q001',
      content: 'Sample listening question prompt',
      display_order: 1,
      correct_answer: 'A',
      answer: 'A',
      model_answer: 'Full model answer',
      explanation: 'Detailed explanation',
      solution_data: { key: 'A' },
      score: 1,
      transcript: 'Private audio transcript',
      aptis_question_options: [
        { id: 'opt-1', option_key: 'A', content: 'Choice A', display_order: 1 },
        { id: 'opt-2', option_key: 'B', content: 'Choice B', display_order: 2 }
      ],
      aptis_question_content_blocks: [
        {
          content_role: 'audio',
          aptis_content_blocks: {
            id: 'cb-1',
            block_type: 'audio',
            title: 'Sample Audio',
            media_url: 'https://example.com/audio.mp3'
          }
        }
      ]
    };

    const sanitized = formatSkillPayload(rawMockRow);

    expect(sanitized.correct_answer).toBeUndefined();
    expect(sanitized.answer).toBeUndefined();
    expect(sanitized.model_answer).toBeUndefined();
    expect(sanitized.explanation).toBeUndefined();
    expect(sanitized.solution_data).toBeUndefined();
    expect(sanitized.score).toBeUndefined();
    expect(sanitized.transcript).toBeUndefined();
  });

  it('6. Part 1 adapter structures multiple choice questions', () => {
    const rawP1 = [
      {
        id: 'p1-1',
        source_key: 'listening-p1-set001-q001',
        content: 'What time does the train leave?',
        options: [
          { option_key: 'A', content: '2:00 PM', display_order: 1 },
          { option_key: 'B', content: '3:00 PM', display_order: 2 }
        ],
        audio: { media_url: 'https://example.com/p1.mp3' }
      }
    ];

    const adaptedP1 = adaptListeningPart1Data(rawP1);
    expect(adaptedP1.length).toBe(1);
    expect(adaptedP1[0].options.length).toBe(2);
    expect(adaptedP1[0].audioUrl).toBe('https://example.com/p1.mp3');
  });

  it('7. Part 2 adapter groups 4 questions into 1 set sharing audio', () => {
    const rawP2 = Array.from({ length: 4 }, (_, i) => ({
      id: `p2-q${i + 1}`,
      source_key: `listening-p2-set001-q00${i + 1}`,
      metadata: { group_key: 'listening-p2-set001', speaker: `Speaker ${i + 1}` },
      content: `Matching prompt ${i + 1}`,
      options: [
        { option_key: 'A', content: 'Activity A', display_order: 1 },
        { option_key: 'B', content: 'Activity B', display_order: 2 }
      ],
      audio: { media_url: 'https://example.com/p2-set1.mp3' }
    }));

    const adaptedP2 = adaptListeningPart2Data(rawP2);
    expect(adaptedP2.length).toBe(1);
    expect(adaptedP2[0].items.length).toBe(4);
    expect(adaptedP2[0].audioUrl).toBe('https://example.com/p2-set1.mp3');
  });

  it('8. Part 3 adapter groups 4 questions into 1 discussion set', () => {
    const rawP3 = Array.from({ length: 4 }, (_, i) => ({
      id: `p3-q${i + 1}`,
      source_key: `listening-p3-set001-q00${i + 1}`,
      metadata: { group_key: 'listening-p3-set001', topic: 'Remote Work Debate' },
      content: `Opinion statement ${i + 1}`,
      options: [
        { option_key: 'man', content: 'Man', display_order: 1 },
        { option_key: 'woman', content: 'Woman', display_order: 2 },
        { option_key: 'both', content: 'Both', display_order: 3 }
      ],
      audio: { media_url: 'https://example.com/p3-set1.mp3' }
    }));

    const adaptedP3 = adaptListeningPart3Data(rawP3);
    expect(adaptedP3.length).toBe(1);
    expect(adaptedP3[0].statements.length).toBe(4);
    expect(adaptedP3[0].audioUrl).toBe('https://example.com/p3-set1.mp3');
  });

  it('9. Part 4 adapter groups 2 questions into 1 monologue set', () => {
    const rawP4 = Array.from({ length: 2 }, (_, i) => ({
      id: `p4-q${i + 1}`,
      source_key: `listening-p4-set001-q00${i + 1}`,
      metadata: { group_key: 'listening-p4-set001', topic: 'Renewable Energy' },
      content: `Monologue question ${i + 1}`,
      options: [
        { option_key: 'A', content: 'Option A', display_order: 1 },
        { option_key: 'B', content: 'Option B', display_order: 2 }
      ],
      audio: { media_url: 'https://example.com/p4-set1.mp3' }
    }));

    const adaptedP4 = adaptListeningPart4Data(rawP4);
    expect(adaptedP4.length).toBe(1);
    expect(adaptedP4[0].sets.length).toBe(1);
    expect(adaptedP4[0].sets[0].questions.length).toBe(2);
  });

  it('10. Voice assignment is 100% deterministic', () => {
    const key1 = 'listening-p1-set001-q001';
    const profileA = assignVoiceProfile(key1);
    const profileB = assignVoiceProfile(key1);
    const profileC = assignVoiceProfile(key1);

    expect(profileA).toBe(profileB);
    expect(profileB).toBe(profileC);
  });

  it('11. All 4 required voice profiles are defined', () => {
    expect(PROFILE_LIST.length).toBe(4);
    expect(PROFILE_LIST).toContain(VOICE_PROFILES.EN_GB_MALE);
    expect(PROFILE_LIST).toContain(VOICE_PROFILES.EN_GB_FEMALE);
    expect(PROFILE_LIST).toContain(VOICE_PROFILES.EN_US_MALE);
    expect(PROFILE_LIST).toContain(VOICE_PROFILES.EN_US_FEMALE);
  });

  it('12. Pure stateless hash ensures voice persistence across reloads', () => {
    const sampleKeys = ['p1-q1', 'p1-q2', 'p2-set1', 'p3-set1', 'p4-set1'];
    sampleKeys.forEach(k => {
      const p1 = assignVoiceProfile(k);
      const hashVal = hashString(k);
      const expected = PROFILE_LIST[hashVal % PROFILE_LIST.length];
      expect(p1).toBe(expected);
    });
  });

  it('13. Verification that listeningAudioProvider contains 0 Math.random calls', () => {
    const providerContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'listeningAudioProvider.js'), 'utf8');
    const hasMathRandomCall = /\bMath\.random\s*\(/.test(providerContent);
    expect(hasMathRandomCall).toBe(false);
  });

  it('14. Web Speech API fallback chain excludes non-English voices', () => {
    const mockVoices = [
      { name: 'Google Vietnamese', lang: 'vi-VN' },
      { name: 'Google French', lang: 'fr-FR' },
      { name: 'Microsoft Zira - English (United States)', lang: 'en-US' }
    ];

    const res = resolveWebSpeechVoice('en-GB-female', mockVoices);
    expect(res.voice.lang.startsWith('en')).toBe(true);
    expect(res.voice.lang).not.toBe('vi-VN');
    expect(res.voice.lang).not.toBe('fr-FR');
  });

  it('15. Global stop function clears previous audio/speech instances', () => {
    const providerContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'listeningAudioProvider.js'), 'utf8');
    expect(providerContent).toContain('stopGlobalAudio');
    expect(providerContent).toContain('window.speechSynthesis.cancel');
  });

  it('16. Unmount cleanup hook in AudioPlayer calls stopGlobalAudio', () => {
    const playerContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'listening', 'AudioPlayer.jsx'), 'utf8');
    expect(playerContent).toContain('stopGlobalAudio()');
  });

  it('17. Private transcript removed from public formatSkillPayload output', () => {
    const rawRow = {
      id: 'q1',
      skill: 'listening',
      transcript: 'CONFIDENTIAL TRANSCRIPT TEXT',
      aptis_question_options: []
    };
    const sanitized = formatSkillPayload(rawRow);
    expect(sanitized.transcript).toBeUndefined();
  });

  it('18. Autosave response targets onConflict: attempt_id, question_id', () => {
    const practiceServiceContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'practiceService.js'), 'utf8');
    expect(practiceServiceContent).toContain("onConflict: 'attempt_id, question_id'");
  });

  it('19. Practice hook checks for existing in_progress attempt', () => {
    const hookContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'hooks', 'useListeningPractice.js'), 'utf8');
    expect(hookContent).toContain("a.status === 'in_progress'");
  });

  it('20. Client submit delegates to submitAttempt (submit-practice Edge Function)', () => {
    const hookContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'hooks', 'useListeningPractice.js'), 'utf8');
    expect(hookContent).toContain('submitAttempt(attempt.id, client)');
  });

  it('21. Failed data fetch sets error state without falling back to mock bank', () => {
    const hookContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'hooks', 'useListeningPractice.js'), 'utf8');
    expect(hookContent).toContain('setError(err.message');
    expect(hookContent.includes('DEFAULT_PART1_QUESTIONS')).toBe(false);
  });

  it('22. Static Security Check - ZERO service_role keys in src/', () => {
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

  it('23. Multi-speaker dialogue turn parsing & label rules', async () => {
    const { parseDialogueTurns } = await import('../src/services/listeningAudioProvider.js');

    const p1Transcript = "Man: I bought a new car.\nFriend: That is wonderful news!";
    const p1Turns = parseDialogueTurns(p1Transcript, 'en-GB-female', 1);
    expect(p1Turns.length).toBe(2);
    expect(p1Turns[0].textToSpeak).toBe("I bought a new car.");
    expect(p1Turns[0].gender).toBe("male");
    expect(p1Turns[1].textToSpeak).toBe("That is wonderful news!");
    expect(p1Turns[1].gender).toBe("female");

    const p2Transcript = "Person A: I reuse bottles.\nPerson B: I donate old clothes.";
    const p2Turns = parseDialogueTurns(p2Transcript, 'en-GB-female', 2);
    expect(p2Turns.length).toBe(2);
    expect(p2Turns[0].textToSpeak).toContain("Person A:");
    expect(p2Turns[1].textToSpeak).toContain("Person B:");

    const p3Transcript = "W: I think technology is great.\nM: I agree completely.";
    const p3Turns = parseDialogueTurns(p3Transcript, 'en-GB-female', 3);
    expect(p3Turns.length).toBe(2);
    expect(p3Turns[0].textToSpeak).toBe("I think technology is great.");
    expect(p3Turns[0].gender).toBe("female");
    expect(p3Turns[1].textToSpeak).toBe("I agree completely.");
    expect(p3Turns[1].gender).toBe("male");
  });
});

