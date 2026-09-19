import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUserDashboardStats, EMPTY_DASHBOARD_STATS } from '../src/services/dashboardService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('Phase Dashboard Statistics Integration Tests', () => {

  it('1. 0 attempt -> 0% progress and No score yet', async () => {
    const mockClient = {
      rpc: (funcName) => {
        expect(funcName).toBe('get_user_dashboard_stats');
        return Promise.resolve({
          data: {
            overall: {
              completedParts: 0,
              totalParts: 16,
              progressPercent: 0,
              latestScore: null,
              latestSkill: null,
              cefrLevel: null,
              studyStreakDays: 0
            },
            skills: {
              listening: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null, maxScore: 100, cefrLevel: null, evaluationStatus: null },
              reading: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null, maxScore: 100, cefrLevel: null, evaluationStatus: null },
              writing: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null, maxScore: 100, cefrLevel: null, evaluationStatus: null },
              speaking: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null, maxScore: 100, cefrLevel: null, evaluationStatus: null }
            }
          },
          error: null
        });
      }
    };

    const stats = await getUserDashboardStats(mockClient);
    expect(stats.overall.completedParts).toBe(0);
    expect(stats.overall.progressPercent).toBe(0);
    expect(stats.overall.latestScore).toBeNull();
    expect(stats.skills.listening.completedParts).toBe(0);
    expect(stats.skills.listening.latestScore).toBeNull();
  });

  it('2. Verify RPC migration file exists and enforces auth.uid() security', () => {
    const migPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20260916000000_dashboard_stats_rpc.sql');
    expect(fs.existsSync(migPath)).toBe(true);
    const sql = fs.readFileSync(migPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats()');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public, pg_temp');
    expect(sql).toContain('v_user_id := auth.uid();');
    expect(sql).not.toContain('v_user_id UUID :=');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats() TO authenticated;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_user_dashboard_stats() FROM PUBLIC;');
  });

  it('3. Reading Part 2 and Part 3 unified into single Part 2-3 unit in SQL', () => {
    const migPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20260916000000_dashboard_stats_rpc.sql');
    const sql = fs.readFileSync(migPath, 'utf8');

    expect(sql).toContain('(CASE WHEN EXISTS (SELECT 1 FROM reading_parts WHERE p IN (2, 3)) THEN 1 ELSE 0 END)');
  });

  it('4. Study streak uses Asia/Ho_Chi_Minh timezone', () => {
    const migPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20260916000000_dashboard_stats_rpc.sql');
    const sql = fs.readFileSync(migPath, 'utf8');

    expect(sql).toContain("AT TIME ZONE 'Asia/Ho_Chi_Minh'");
  });

  it('5. Score 0 is valid numeric score and not turned into null', async () => {
    const mockClient = {
      rpc: () => Promise.resolve({
        data: {
          overall: { completedParts: 1, totalParts: 16, progressPercent: 6, latestScore: 0, latestSkill: 'listening' },
          skills: {
            listening: { completedParts: 1, totalParts: 4, progressPercent: 25, latestScore: 0, evaluationStatus: 'completed' },
            reading: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null },
            writing: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null },
            speaking: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null }
          }
        },
        error: null
      })
    };

    const stats = await getUserDashboardStats(mockClient);
    expect(stats.skills.listening.latestScore).toBe(0);
    expect(stats.skills.listening.evaluationStatus).toBe('completed');
  });

  it('6. Pending Speaking/Writing evaluation status is handled correctly', async () => {
    const mockClient = {
      rpc: () => Promise.resolve({
        data: {
          overall: { completedParts: 1, totalParts: 16, progressPercent: 6, latestScore: null },
          skills: {
            listening: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null },
            reading: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null },
            writing: { completedParts: 1, totalParts: 4, progressPercent: 25, latestScore: null, evaluationStatus: 'pending' },
            speaking: { completedParts: 0, totalParts: 4, progressPercent: 0, latestScore: null }
          }
        },
        error: null
      })
    };

    const stats = await getUserDashboardStats(mockClient);
    expect(stats.skills.writing.latestScore).toBeNull();
    expect(stats.skills.writing.evaluationStatus).toBe('pending');
  });

  it('7. Browser source files (src/) contain no service-role key or private DB access', () => {
    const srcDir = path.join(ROOT_DIR, 'src');

    function audit(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let violations = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations = violations.concat(audit(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            violations.push(`${entry.name}: contains SUPABASE_SERVICE_ROLE_KEY`);
          }
          if (content.includes('service_role')) {
            violations.push(`${entry.name}: contains service_role`);
          }
          if (/\.from\s*\(\s*['"`]aptis_question_answers['"`]\s*\)/i.test(content)) {
            violations.push(`${entry.name}: queries aptis_question_answers directly`);
          }
        }
      }
      return violations;
    }

    const violations = audit(srcDir);
    expect(violations.length).toBe(0);
  });

  it('8. Dashboard component & data contain no hardcoded mock statistics', () => {
    const dashboardDataCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'data', 'dashboardData.js'), 'utf8');

    expect(dashboardDataCode).not.toContain('progress: 75');
    expect(dashboardDataCode).not.toContain('progress: 60');
    expect(dashboardDataCode).not.toContain('progress: 50');
    expect(dashboardDataCode).not.toContain('progress: 40');
    expect(dashboardDataCode).not.toContain('82/100');
    expect(dashboardDataCode).not.toContain('78/100');
    expect(dashboardDataCode).not.toContain('70/100');
    expect(dashboardDataCode).not.toContain('65/100');
    expect(dashboardDataCode).not.toContain('days: 7');
  });

  it('9. Writing & Speaking cards are configured to Full Practice mode in dashboardData', () => {
    const dashboardDataCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'data', 'dashboardData.js'), 'utf8');

    expect(dashboardDataCode).toContain('id: "writing"');
    expect(dashboardDataCode).toContain('id: "speaking"');
    expect(dashboardDataCode).not.toContain('defaultMode: "part"');
  });

  it('10. Custom submission event aptis:attempt-submitted is dispatched in submissionService.js', () => {
    const submissionServiceCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'submissionService.js'), 'utf8');

    expect(submissionServiceCode).toContain("window.dispatchEvent(new CustomEvent('aptis:attempt-submitted'");
  });
});
