# Aptis AI Evaluation Contract Specification

## 1. Overview & Architecture

This document defines the strict API, Database, and Rubric contract for the Aptis Writing and Speaking AI Evaluation system in OnAptis. This specification acts as an immutable contract for frontend client interactions and the upcoming transition to an ASP.NET Core / C# backend.

```
+-------------------+        +----------------------------+        +---------------------------+
| React Frontend UI | -----> | evaluationApiClient (JS)   | -----> | Backend API / Edge Function|
+-------------------+        +----------------------------+        +---------------------------+
                                                                                  |
                                                                                  v
                                                                   +------------------------------+
                                                                   | practice_response_evaluations|
                                                                   +------------------------------+
```

---

## 2. API Contract

### Response Submission Endpoint (`submit_question`)
- **Method**: `POST`
- **Path**: `/functions/v1/submit-practice` (or `/api/v1/practice/submit-response`)
- **Headers**: `Authorization: Bearer <user_jwt>`, `Content-Type: application/json`
- **Request DTO**:
```json
{
  "action": "submit_question",
  "attempt_id": "UUID",
  "question_id": "UUID",
  "response": {
    "text": "User written answer or transcript",
    "word_count": 45,
    "recording_path": "userId/attemptId/responseId/v1.webm"
  }
}
```
- **Async Response DTO (HTTP 202 Accepted)**:
```json
{
  "success": true,
  "attemptId": "UUID",
  "responseId": "UUID",
  "evaluationId": "UUID",
  "evaluationStatus": "pending",
  "message": "Response received and queued for AI evaluation."
}
```

---

## 3. Database Schema Contract (`public.practice_response_evaluations`)

| Column Name | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key (`gen_random_uuid()`) |
| `response_id` | `UUID` | FK `public.practice_responses(id)` ON DELETE CASCADE |
| `attempt_id` | `UUID` | FK `public.practice_attempts(id)` ON DELETE CASCADE |
| `question_id` | `UUID` | FK `public.aptis_questions(id)` ON DELETE CASCADE |
| `skill` | `aptis_skill_enum` | `'reading' \| 'listening' \| 'writing' \| 'speaking'` |
| `part_number` | `INT` | Part 1, 2, 3, 4 |
| `status` | `VARCHAR(20)` | `CHECK (status IN ('pending', 'processing', 'needs_review', 'completed', 'failed'))` |
| `evaluator_type` | `VARCHAR(20)` | `CHECK (evaluator_type IN ('ai', 'human'))` |
| `provider` | `VARCHAR(50)` | `'openai'`, `'mock-provider'` |
| `model_name` | `VARCHAR(100)` | e.g. `'gpt-4o-mini'` |
| `raw_score` | `NUMERIC` | Sum of raw criteria scores |
| `max_score` | `NUMERIC` | Maximum possible raw score |
| `normalized_score` | `NUMERIC` | Score normalized to 0 - 100 range |
| `cefr_level` | `VARCHAR(20)` | `CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1'))` (C2 EXCLUDED) |
| `rubric_result` | `JSONB` | Criteria scores, spelling feedback, coverage |
| `strengths` | `JSONB` | Array of strength strings |
| `improvements` | `JSONB` | Array of improvement strings |
| `feedback` | `TEXT` | Overall qualitative summary feedback |
| `version` | `INT` | Evaluation version (starts at 1) |
| `supersedes_evaluation_id` | `UUID` | FK self-reference to previous evaluation version |

### Partial Unique Index (Idempotency)
```sql
CREATE UNIQUE INDEX idx_active_evaluation_per_response 
  ON public.practice_response_evaluations(response_id) 
  WHERE status IN ('pending', 'processing');
```

---

## 4. Evaluation Rubric Rules

1. **CEFR Ceilings**:
   - Part 1: B1 max
   - Part 2: B2 max
   - Part 3: B2 max
   - Part 4: C1 max (C2 is strictly forbidden)
2. **Mandatory Label**:
   - All evaluation outputs must be labeled `"AI practice estimate"`.
3. **Sample Answer Usage**:
   - Sample / model answers are reference examples ONLY. Candidates MUST NOT be penalized for alternative valid phrasing.
4. **Audio Capabilities & Pronunciation Guard**:
   - If audio recording is missing or provider performs transcript-only evaluation, `pronunciation` and `audioFluencyBand` MUST be `null`, `cefr_level` MUST be `null`, and `status` MUST be set to `'needs_review'`.
