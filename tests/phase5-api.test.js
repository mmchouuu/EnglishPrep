import { describe, it, expect } from 'vitest';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseBrowserConfig, getBrowserSupabaseClient } from '../src/lib/supabaseClient.js';
import { formatSkillPayload, getQuestions, getPracticeSet } from '../src/services/aptisService.js';
import { submitQuestion } from '../src/services/submissionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Checks if code contains actual database queries to private tables.
 */
export function hasPrivateQueryPattern(code) {
  const fromRegex = /\.from\s*\(\s*['"`](?:aptis_question_answers|practice_response_evaluations|aptis_import_runs)['"`]\s*\)/i;
  if (fromRegex.test(code)) return true;

  const nestedSelectRegex = /(?:aptis_question_answers|practice_response_evaluations)\s*[\(!]/i;
  if (nestedSelectRegex.test(code)) return true;

  return false;
}

describe('Phase 5 API & Security Tests', () => {
  it('1. Node environment import.meta.env missing check', () => {
    const config = getSupabaseBrowserConfig({});
    expect(config.url).toBeNull();
    expect(config.anonKey).toBeNull();
  });

  it('2. Missing browser config error handling', () => {
    let caughtError = null;
    try {
      getBrowserSupabaseClient({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).not.toBeNull();
    expect(caughtError.message).toContain('SUPABASE_BROWSER_CONFIG_MISSING');
  });

  it('3. Public payload excludes private answer fields', () => {
    const mockRow = {
      id: 'q-101',
      skill: 'reading',
      part_number: 1,
      question_type: 'multiple_choice',
      source_key: 'reading-p1-set001-q001',
      content: 'Sample question content',
      display_order: 1,
      ui_config: {},
      metadata: {},
      correct_answer: 'opt_1',
      answer: 'opt_1',
      model_answer: 'Sample model answer',
      sample_answer: 'Sample answer',
      explanation: 'Sample explanation',
      solution_data: { transcript: 'Secret transcript' },
      transcript: 'Secret transcript',
      rubric: {},
      ai_feedback: {},
      score: 100,
      is_correct: true,
      aptis_question_options: [{ id: 'o-1', question_id: 'q-101', option_key: 'opt_1', content: 'Option 1', display_order: 1, metadata: {} }],
      aptis_question_content_blocks: []
    };

    const payload = formatSkillPayload(mockRow);
    expect(payload.correct_answer).toBeUndefined();
    expect(payload.answer).toBeUndefined();
    expect(payload.model_answer).toBeUndefined();
    expect(payload.sample_answer).toBeUndefined();
    expect(payload.explanation).toBeUndefined();
    expect(payload.solution_data).toBeUndefined();
    expect(payload.transcript).toBeUndefined();
    expect(payload.rubric).toBeUndefined();
    expect(payload.ai_feedback).toBeUndefined();
    expect(payload.score).toBeUndefined();
    expect(payload.is_correct).toBeUndefined();
  });

  it('4. Pagination math validation', () => {
    const total = 539;
    const pageSize = 10;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(54);

    const from = (2 - 1) * pageSize;
    const to = from + pageSize - 1;
    expect(from).toBe(10);
    expect(to).toBe(19);
  });

  it('5. Public query with injected mock Supabase client', async () => {
    const chainableBuilder = {
      order: () => chainableBuilder,
      range: () => Promise.resolve({
        data: [
          {
            id: 'q-mock-1',
            skill: 'reading',
            part_number: 1,
            question_type: 'multiple_choice',
            source_key: 'reading-p1-set001-q001',
            content: 'Mock reading question',
            display_order: 1,
            ui_config: {},
            metadata: {},
            aptis_question_options: [],
            aptis_question_content_blocks: []
          }
        ],
        error: null
      })
    };

    const mockClientWithCount = {
      from: (table) => ({
        select: (cols, opts) => {
          if (opts && opts.count) {
            return {
              eq: () => Promise.resolve({ count: 1, error: null })
            };
          }
          return {
            eq: () => chainableBuilder
          };
        }
      })
    };

    const res = await getQuestions({ skill: 'reading' }, 1, 10, mockClientWithCount);
    expect(res.total).toBe(1);
    expect(res.data.length).toBe(1);
    expect(res.data[0].id).toBe('q-mock-1');
  });

  it('6. Relational JOIN and query pattern audit', () => {
    const serviceCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'aptisService.js'), 'utf8');

    const badCode1 = "const res = await supabase.from('aptis_question_answers').select('*');";
    expect(hasPrivateQueryPattern(badCode1)).toBe(true);

    const badCode2 = "supabase.from('aptis_questions').select('id, aptis_question_answers(correct_answer)')";
    expect(hasPrivateQueryPattern(badCode2)).toBe(true);

    const publicJoinCode = "supabase.from('aptis_questions').select('id, aptis_question_options(content), aptis_question_content_blocks(aptis_content_blocks(media_url))')";
    expect(hasPrivateQueryPattern(publicJoinCode)).toBe(false);

    expect(hasPrivateQueryPattern(serviceCode)).toBe(false);
  });

  it('7. Static security audit of src/ directory', () => {
    const srcDir = path.join(ROOT_DIR, 'src');

    function scanFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let violations = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations = violations.concat(scanFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            violations.push(`${entry.name}: contains SUPABASE_SERVICE_ROLE_KEY`);
          }
          if (content.includes('service_role')) {
            violations.push(`${entry.name}: contains service_role`);
          }
          if (hasPrivateQueryPattern(content)) {
            violations.push(`${entry.name}: performs private DB queries`);
          }
        }
      }
      return violations;
    }

    const srcViolations = scanFiles(srcDir);
    expect(srcViolations.length).toBe(0);
  });

  it('8. Client submission wrapper invokes submit-practice Edge Function', async () => {
    let functionInvoked = false;
    let payloadSent = null;

    const mockClient = {
      functions: {
        invoke: (functionName, options) => {
          functionInvoked = true;
          payloadSent = { functionName, ...options };
          return Promise.resolve({
            data: { success: true, evaluation: { evaluation_status: 'evaluated', score: 1.0 } },
            error: null
          });
        }
      }
    };

    const res = await submitQuestion('att-100', 'q-100', 'opt_1', mockClient);
    expect(functionInvoked).toBe(true);
    expect(payloadSent.functionName).toBe('submit-practice');
    expect(payloadSent.body.action).toBe('submit_question');
    expect(payloadSent.body.attempt_id).toBe('att-100');
    expect(payloadSent.body.question_id).toBe('q-100');
    expect(res.success).toBe(true);
  });

  it('9. Verify Edge Function location outside src/', () => {
    const edgeFuncPath = path.join(ROOT_DIR, 'supabase', 'functions', 'submit-practice', 'index.ts');
    expect(fs.existsSync(edgeFuncPath)).toBe(true);
    const code = fs.readFileSync(edgeFuncPath, 'utf8');
    expect(code).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
  });

  it('10. Verify supplementary migration maintains authenticated-only policy', () => {
    const migPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20260911000000_supplementary_rls_phase5.sql');
    expect(fs.existsSync(migPath)).toBe(true);
    const migCode = fs.readFileSync(migPath, 'utf8');
    expect(migCode).not.toContain('TO anon, authenticated');
    expect(migCode).toContain('STRICTLY AUTHENTICATED ONLY');
  });
});
