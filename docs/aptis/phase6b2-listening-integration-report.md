# Aptis Listening Phase 6B2 Integration Report

**Date**: 2026-09-13  
**Module**: Aptis Listening Practice System (`/listening/part-1` .. `/listening/part-4`)  
**Status**: `Static Listening integration completed — runtime verification pending.`

---

## 1. Files Created and Modified

### Created Files:
1. `src/services/listeningAudioProvider.js`: Deterministic voice assignment module, Web Speech API fallback provider, and global single-audio playback controller.
2. `src/adapters/listeningAdapter.js`: Data adapter converting public Supabase questions into exact props for Parts 1–4 UI, with strict defense-in-depth sanitization of private fields.
3. `src/hooks/useListeningPractice.js`: Custom React hook enforcing RLS auth status isolation, lazy question fetching, attempt resumption (`in_progress`), debounced autosaving, bookmarking, and Edge Function submission.
4. `tests/phase6b-listening-integration.test.js`: Executable static unit test suite covering 22 integration requirement assertions.
5. `docs/aptis/phase6b2-listening-integration-report.md`: Phase 6B2 integration documentation.

### Modified Files:
1. `src/components/listening/AudioPlayer.jsx`: Integrated with `listeningAudioProvider.js` for HTML5 `<audio>` and Web Speech API TTS fallback, playback rate controls, replay count tracking, and voice profile badges.
2. `src/components/listening/Part1ShortConversations.jsx`: Connected with real questions, individual audio players, check answer, and bookmarking.
3. `src/components/listening/Part2InformationMatching.jsx`: Connected with 4-question sets sharing 1 audio block and DB option dropdowns.
4. `src/components/listening/Part3OpinionMatching.jsx`: Connected with 4-question opinion matching sets sharing 1 discussion audio block.
5. `src/components/listening/Part4Monologues.jsx`: Connected with 2-question monologue sets sharing 1 audio block and topic headers.
6. `src/components/ListeningPractice.jsx`: Main container updated with `useListeningPractice` hook, RLS auth loading/required/error/empty states, URL persistence, and submit modal.

---

## 2. Mock Listening Data Removal

- Removed direct reliance on `dbService.js` mock data loader and `DEFAULT_PART1_QUESTIONS`, `DEFAULT_PART2_SETS`, `DEFAULT_PART3_SETS`, and `DEFAULT_PART4_TOPICS` fallback constants inside runtime flow.
- All 4 Listening parts now read directly from Supabase database tables via `aptisService.getQuestions()` and `aptisService.getGroups()`.
- Error state now clearly indicates network or connection issues without falling back to mock data.

---

## 3. Database & Route Mapping

| Route | DB Part Number | Question Type | Content Block Type | Structure |
|---|---|---|---|---|
| `/listening/part-1` | `part_number = 1` | `multiple_choice` | `audio` (1 per question) | 286 questions, 22 sets x 13 questions |
| `/listening/part-2` | `part_number = 2` | `listening_matching` | `audio` (1 per set) | 176 questions, 44 sets x 4 questions |
| `/listening/part-3` | `part_number = 3` | `listening_matching` | `audio` (1 per set) | 176 questions, 44 sets x 4 questions |
| `/listening/part-4` | `part_number = 4` | `listening_multiple_choice` | `audio` (1 per set) | 120 questions, 60 sets x 2 questions |

---

## 4. Security & Data Protection Boundaries

1. **Answer & Evaluation Isolation**:
   - Frontend NEVER queries `aptis_question_answers` or `practice_response_evaluations`.
   - `formatSkillPayload()` and `listeningAdapter.js` explicitly strip `correct_answer`, `correct_option`, `answer_key`, `model_answer`, `solution`, `explanation`, `score`, and `evaluation`.
   - Client submission delegates to Edge Function `submitAttempt(attemptId, client)`.
2. **Transcript Privacy**:
   - Private transcript is excluded from public payloads prior to submission.
   - Transcript is default collapsed and excluded from console logging.
3. **Zero Secrets in Frontend**:
   - `SUPABASE_SERVICE_ROLE_KEY` and `service_role` strings are 100% absent from `src/`.

---

## 5. Audio & TTS Multi-Voice Architecture

### 4 Baseline Voice Profiles:
- `en-GB-female`: Female British English voice.
- `en-GB-male`: Male British English voice.
- `en-US-female`: Female American English voice.
- `en-US-male`: Male American English voice.

### Deterministic Assignment:
- Voice profiles are assigned using pure DJB2 string hashing on `source_key` / `audio_block_key`.
- 0% `Math.random()` usage — reload yields 100% identical voice allocation.
- Part 3 discussion maps Speaker A (Man) and Speaker B (Woman) to distinct voice profiles.

### Web Speech API Fallback Chain:
1. Requested profile match (`lang` + gender keywords).
2. Same accent alternate gender.
3. Any English voice installed in browser (`lang.startsWith('en')`).
4. Non-English voices (e.g. Vietnamese, French) are strictly excluded.

### Player Capabilities:
- Single active audio instance globally (playing new audio automatically stops previous speech/audio).
- Supports Play, Pause, Resume, Stop, Playback speed (0.75x, 1x, 1.25x), Volume, Mute, and Replay counter tracking.

---

## 6. Attempt Resumption, Autosaving, & URL Persistence

- **Attempt Resumption**: Hook looks for existing `in_progress` attempt for user + skill `'listening'` + `part_number` + `practice_mode`.
- **Autosave**: Debounced upsert to `practice_responses` targeting conflict key `attempt_id, question_id`.
- **URL Parameters**: URL query parameters (`mode`, `group`, `question`, `set`) serve as source of truth across F5 refresh and browser history navigation.

---

## 7. Commands for Manual Execution

To execute static unit tests and build/dev server locally, please run:

```powershell
# 1. Run static unit test suite for Listening Integration (22 tests)
node .\tests\phase6b-listening-integration.test.js

# 2. Build production bundle
npm run build

# 3. Start local development server
npm run dev
```

---

**Final Status**:  
`Static Listening integration completed — runtime verification pending.`
