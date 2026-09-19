# Phase 6B3 Writing UI & Supabase Integration Report

**Date**: September 13, 2026  
**Status**: Static Writing UI and Supabase integration completed — runtime verification pending.

---

## 1. Architecture Summary

The Writing practice skill has been fully integrated with Supabase Local public database tables, RLS authentication, autosaving, session draft persistence, and serverless Edge Function submission boundaries.

```
                    ┌─────────────────────────────────────────────────┐
                    │               WritingPractice.jsx               │
                    │        (UI Renderer & Component Props)          │
                    └────────────────────────┬────────────────────────┘
                                             │
                                             ▼
                    ┌─────────────────────────────────────────────────┐
                    │            useWritingPractice Hook              │
                    │    (Auth, State, Autosave, Drafts, Attempt)     │
                    └────────────┬───────────────────────┬────────────┘
                                 │                       │
                                 ▼                       ▼
            ┌──────────────────────────────┐   ┌──────────────────────────┐
            │      writingAdapter.js       │   │     aptisService.js      │
            │  (Sanitization & View Model) │   │ (Public Questions Query) │
            └──────────────────────────────┘   └─────────────┬────────────┘
                                                             │
                                                             ▼
                                               ┌──────────────────────────┐
                                               │   Supabase Local (RLS)   │
                                               └──────────────────────────┘
```

---

## 2. Files Created and Modified

### Created Files:
1. `src/adapters/writingAdapter.js`
   - Transforms sanitized public DB question rows into exact view models for Writing Parts 1, 2, 3, 4.
   - Includes real-time `countWords` and `resolveWordLimit` (DB metadata first, Aptis standard fallbacks second).
   - Sanitizes and pairs Part 4 Informal and Formal emails while extracting instruction content blocks.
2. `src/hooks/useWritingPractice.js`
   - Handles strict RLS auth state (`loading` → `unauthenticated` → `authenticated`).
   - Fetches writing clubs/groups and questions dynamically per skill, part, and practice mode (`byPart` vs `byClub`).
   - Manages attempt lifecycle (`in_progress` resumption / creation).
   - Debounced autosave (800ms) to `practice_responses`.
   - Local session draft persistence (`sessionStorage`) with priority restoration.
   - Dispatches submissions via `submit-practice` Edge Function boundary.
3. `tests/phase6b-writing-integration.test.js`
   - Contains 7 static unit test suites covering word counter, word limits, adapter transformations for Parts 1–4, and public payload security.
4. `docs/aptis/phase6b-writing-integration-report.md`
   - Documentation report summarizing integration architecture, files changed, and verification instructions.

### Modified Files:
1. `src/components/WritingPractice.jsx`
   - Completely replaced legacy `dbService` / mock data calls with real DB hook `useWritingPractice`.
   - Maintained 100% of existing UI layout, typography, colors, dark mode, card dimensions, and icons.
   - Integrated Auth Required state for unauthenticated users with redirect back-link to `/login`.
   - Added autosave indicator (`Saving draft...` / `✓ Draft saved`).
   - Added Edge Function submit confirmation modal.
2. `src/services/aptisService.js`
   - Updated `getGroups` to properly query `aptis_groups` for `skill = 'writing'` clubs without forcing `listening` or `reading` set key regex filters.

---

## 3. Mock Data Elimination

- Removed `getFullBank()` call from `WritingPractice.jsx`.
- Removed all hardcoded club lists, question lists, and mock prompts.
- All 521 questions and 65 writing clubs are now fetched directly from Supabase Local database table `aptis_questions` and `aptis_groups`.

---

## 4. Mapping per Writing Part

| Part | Task Type | DB Question Count | View Model Mapping |
| :--- | :--- | :--- | :--- |
| **Part 1** | `short_answer` (`text_input`) | 235 | Club object containing array of 5 short answer questions (1–5 words each). |
| **Part 2** | `short_text` (`text_input`) | 48 | Short text response to club message (20–30 words). |
| **Part 3** | `chat_response` (`text_input`) | 144 | 3 chat responses to 3 club members (30–40 words each), sorted by `display_order`. |
| **Part 4** | `email_writing` | 94 | 47 logical pairs of Informal email (40–50 words) & Formal email (120–150 words) linked to instruction block (Club notice scenario). |

---

## 5. Security & Private Data Protection

- `src/adapters/writingAdapter.js` and `aptisService.js` strictly exclude `correct_answer`, `model_answer`, `sample_answer`, `rubric`, `solution_data`, and private scores before submit.
- No `service_role` keys present in `src/`.
- Unauthenticated users cannot query questions, create attempts, or save responses.
- Writing submissions set `evaluation_status = 'pending'` for secure Edge Function / server-side evaluation.

---

## 6. Verification Status

`Static Writing UI and Supabase integration completed — runtime verification pending.`
