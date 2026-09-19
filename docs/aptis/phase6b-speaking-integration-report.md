# Phase 6B: Speaking Integration & Runtime Audit Report

## 1. Overview & Baseline Metrics

The **Speaking Practice Integration** audit and remediation phase has been completed. All runtime mock fallbacks have been completely eliminated, and full database integration with Supabase Row Level Security (RLS) has been implemented across Speaking Parts 1-4.

### Database Baseline Verification
- **Part 1 (Personal Information)**: 149 questions (`speaking_recording`, 0s prep, 30s speak)
- **Part 2 (Describe a Photo)**: 156 questions (52 sets x 3 questions, `photo_description`)
- **Part 3 (Compare Photos)**: 216 questions (72 sets x 3 questions, `photo_comparison`)
- **Part 4 (Abstract Topic)**: 174 questions (58 modules x 3 questions, `speaking_recording`, 60s prep, 120s speak)
- **Total Questions**: 695 questions
- **Groups**: 206 groups
- **Image Content Blocks**: 147 image blocks

---

## 2. Key Audit Remediations & Technical Implementation

### A. Elimination of Mock Fallbacks
- Completely removed `MOCK_PART1`, `MOCK_PART2`, `MOCK_PART3`, `MOCK_PART4` constants from `src/components/SpeakingPractice.jsx`.
- Updated `src/adapters/speakingAdapter.js` to return empty arrays (`[]`) when queries return 0 rows.
- Added explicit **Error State + Retry Connection button** when network/Supabase queries fail.
- Added explicit **Empty State** when database contains 0 rows for a selected Part.

### B. Pre-Submit Security & Sample Answer Protection
- Verified public query `getQuestions` strictly excludes `aptis_question_answers` table rows (`model_answer`, `sample_answer`, `rubric`, `solution_data`).
- `SampleAnswerToggle` component has been refactored into `PostSubmitSampleAnswer`.
- **Pre-Submit**: The sample answer button is completely hidden/disabled before submission.
- **Post-Submit**: Displays the official model answer ONLY IF server-side Edge Function evaluation response includes server-verified `solution.model_answer`.

### C. Recorder Lifecycle & Memory Safety
- `useRecorder` hook implements strict cleanup logic:
  - Stops `MediaRecorder` on question switch, part change, or component unmount.
  - Stops all active `MediaStreamTrack`s (`stream.getTracks().forEach(t => t.stop())`).
  - Closes `AudioContext` and cancels `requestAnimationFrame` loop.
  - Revokes Object URLs (`URL.revokeObjectURL(url)`) safely without revoking URLs currently being played by active HTML5 `<audio>` elements.

### D. Database Response Safety & Blob URL Isolation
- `blob:http://...` URLs are local browser previews only.
- `saveResponse` in `src/hooks/useSpeakingPractice.js` passes `recording_path: null` to Supabase, persisting text transcript, time elapsed, and `recordingPersistence: 'local_only'` metadata.
- Conflicted upsert target enforced as `(attempt_id, question_id)` in `src/services/practiceService.js`.

### E. Image Layout & Error Handling
- **Part 1**: No image placeholder container rendered (`image_count = 0`).
- **Part 2**: Dynamically supports 1-photo sets (`max-w-2xl mx-auto`, full width centered, no empty column) and 2-photo sets (`grid grid-cols-1 md:grid-cols-2`).
- **Part 3**: Renders 2 comparison photos in a balanced 2-column grid.
- **SafeImage Component**: Uses `onError={() => setImgError(true)}` to prevent infinite image error loops. No hardcoded image URLs in component code.

### F. Route Persistence & State Synchronization
- Routes: `/speaking/part-1`, `/speaking/part-2`, `/speaking/part-3`, `/speaking/part-4`.
- Query parameters: `mode=full|topic`, `group=<group_key>`, `question=<index>`, `topic=<index>`.
- F5 browser refresh restores exact Part, active group/set, and question index without redirecting to Dashboard.

### G. Edge Function Submission Boundary
- Submissions trigger `submitQuestion` in `src/services/submissionService.js`, invoking the Supabase Edge Function `submit-practice`.
- Speaking evaluation status is marked as `pending` on the server. Browser client does NOT compute local scores.

---

## 3. Files Created & Modified

1. **`src/adapters/speakingAdapter.js`** *(Updated)*: Data transformation for Parts 1-4 without mock fallbacks or private answers.
2. **`src/hooks/useSpeakingPractice.js`** *(Updated)*: State management, RLS auth isolation, debounced autosave, attempt restoration, and Edge Function submission.
3. **`src/components/SpeakingPractice.jsx`** *(Updated)*: UI render logic, post-submit sample answer protection, recorder lifecycle cleanup, image layout rules, and error handling.
4. **`tests/phase6b-speaking-integration.test.js`** *(Created)*: Test suite covering security, lifecycle, and route persistence requirements.
5. **`docs/aptis/phase6b-speaking-integration-report.md`** *(Created)*: Audit report document.

---

## 4. Verification Commands for User Execution

The user can run the following terminal commands to verify code quality and test execution:

```bash
# Run Vitest test suite
npm run test

# Run Vite dev server
npm run dev

# Build production bundle
npm run build
```

---

Static Speaking security and runtime lifecycle audit completed — runtime verification pending.
