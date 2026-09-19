# Phase 6B1 — Reading Integration Report

**Date:** September 11, 2026  
**Status:** Static integration completed — runtime verification pending.

---

## 1. Executive Summary

Phase 6B1 connects the Reading UI components to the production Supabase Local database schema with **strict RLS authentication isolation** while preserving **100% of the existing approved user interface, CSS styling, dark mode configuration, layouts, and navigation widgets**.

Unauthenticated users are clearly presented with an **Auth Required** state and redirected to a dedicated `/login` auth page. Upon successful sign-in, users are automatically returned to their exact original Reading URL path and query parameters.

---

## 2. Reading Data Architecture & Route Mapping

| UI Route | Database `part_number` | Question Type | DB Source Tables / Views |
| :--- | :--- | :--- | :--- |
| `/reading/part-1` | `1` | `multiple_choice` | `aptis_questions`, `aptis_question_options` |
| `/reading/part-2-3` | `2` | `sentence_ordering` | `aptis_questions`, `aptis_question_options` |
| `/reading/part-4` | `4` | `opinion_matching` | `aptis_questions`, `aptis_content_blocks`, `aptis_question_content_blocks` |
| `/reading/part-5` | `5` | `heading_matching` | `aptis_questions`, `aptis_question_options`, `aptis_content_blocks` |

---

## 3. Files Created & Modified

### Created Files:
1. `src/components/LoginPage.jsx`
   - Dedicated Supabase Auth page supporting Sign In / Register tabs, form validation, error states, and automatic return URL navigation (`redirectTo`).

2. `src/adapters/readingAdapter.js`
   - `adaptPart1Data`: Transforms public `multiple_choice` questions & options for Part 1.
   - `adaptPart2Data`: Transforms `sentence_ordering` options into sentence array sets for Part 2-3.
   - `adaptPart4Data`: Parses passage block content into Person A–D opinions for Part 4.
   - `adaptPart5Data`: Parses passage blocks into paragraphs and extracts heading options for Part 5.

3. `src/hooks/useReadingPractice.js`
   - Enforces 4 explicit auth states (`authLoading`, `unauthenticated`, `authenticated & loading`, `authenticated & isEmpty`).
   - Prevents fetching Reading questions until `authStatus === 'authenticated'`.
   - Manages `practice_attempts` creation/resumption using `authUser.id` strictly from session.
   - Manages debounced response autosaving (`saveResponse`).
   - Manages sessionStorage draft fallback.
   - Handles Edge Function submissions (`submitAttempt`).

4. `tests/phase6b-reading-integration.test.js`
   - Unit test suite covering 12 core requirements (auth status isolation, Auth Required UI mapping, return URL preservation, adapter structures, and Edge Function invocation).

5. `docs/aptis/phase6b1-reading-integration-report.md`
   - Comprehensive technical documentation of Phase 6B1 implementation.

### Modified Files:
1. `src/App.jsx`
   - Registered `/login` route for Supabase Auth.

2. `src/components/Navbar.jsx`
   - Integrated session listener (`onAuthStateChange`).
   - Added user email badge and Sign Out button when authenticated, and Sign In link when unauthenticated.

3. `src/components/ReadingPractice.jsx`
   - Integrated `useReadingPractice` hook with authStatus handling.
   - Added prominent Auth Required card with Sign In redirect for unauthenticated sessions.
   - Connected Part 1, 2-3, 4, 5 and navigators to real database payloads.
   - Retained 100% of visual design, colors, badges, dark mode, modals, and navigation buttons.

---

## 4. Auth Session & Return URL Redirection

- **RLS Isolation:** Reading queries are gated by `authStatus === 'authenticated'`. Unauthenticated users are **never** shown an empty database message.
- **Return URL Preservation:** When an unauthenticated user attempts to access `/reading/part-4?mode=topic...`, the application encodes `redirectTo` into the login URL (`/login?redirectTo=%2Freading%2Fpart-4%3Fmode%3Dtopic...`).
- **Post-Login Navigation:** After successful authentication, `LoginPage.jsx` automatically redirects the user back to the exact URL they were attempting to access.

---

## 5. Security & Private Answer Protection

- **Zero Client Answer Leaks:** Frontend queries **never** query or select from `aptis_question_answers` or `practice_response_evaluations`.
- **Payload Defense-in-Depth:** `aptisService.formatSkillPayload` and `readingAdapter` sanitize all records, stripping `correct_answer`, `answer`, `model_answer`, `explanation`, `solution_data`, `score`, and `rubric`.
- **Secure Server-Side Grading:** Submissions invoke the Supabase Edge Function `submit-practice` via `submissionBoundary.js`. Scores and feedback are calculated server-side only after user submission.

---

## 6. How to Create a Local User Account for Testing

1. Open `http://localhost:5173/login` in your browser.
2. Click the **Register** tab.
3. Enter any test email (e.g., `user@example.com`) and password (minimum 6 characters, e.g., `123456`).
4. Click **Create Account**. Supabase Auth Local will register the user.
5. After sign-in, the browser will automatically redirect you back to `/reading/part-1` (or your previous Reading route) with an active authenticated session.

---

## 7. Verification Commands for User Execution

The following PowerShell commands can be executed in the terminal by the user to verify Phase 6B1 implementation:

```powershell
# 1. Run Phase 6B1 integration unit test
node .\tests\phase6b-reading-integration.test.js

# 2. Run project build check
npm run build

# 3. Start development server to test UI
npm run dev

# 4. Check Supabase Local service status
npx supabase status

# 5. Read-only SQL query to verify user practice attempts created
docker exec -it supabase_db_OnAptis psql -U postgres -d postgres -c "SELECT id, user_id, skill, part_number, status, started_at FROM practice_attempts WHERE skill = 'reading' ORDER BY started_at DESC LIMIT 5;"

# 6. Read-only SQL query to verify autosaved responses
docker exec -it supabase_db_OnAptis psql -U postgres -d postgres -c "SELECT attempt_id, question_id, response, answered_at FROM practice_responses ORDER BY answered_at DESC LIMIT 5;"
```

---

**Status:** Static integration completed — runtime verification pending.
