-- ============================================================================
-- Migration: AI Evaluation Schema Enhancements, Durable Job Claiming & Storage RLS
-- File: supabase/migrations/20260917000000_ai_evaluation_schema.sql
-- Created at: 2026-09-17
-- Scope: Versioned AI Evaluations, Durable Job Claiming, Pure CEFR Check, Storage Dual RLS, and Dashboard RPC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REFACTOR / EXPAND practice_response_evaluations TABLE FOR VERSIONING
-- ----------------------------------------------------------------------------

-- 1.1 Drop legacy primary key if response_id was PK
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.key_column_usage 
    WHERE constraint_name = 'practice_response_evaluations_pkey' 
      AND column_name = 'response_id'
      AND table_name = 'practice_response_evaluations'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.practice_response_evaluations DROP CONSTRAINT practice_response_evaluations_pkey CASCADE;
  END IF;
END $$;

-- 1.2 Add Columns for Evaluation Versioning, Scores, and Metadata
ALTER TABLE public.practice_response_evaluations
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.practice_attempts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS skill public.aptis_skill_enum,
  ADD COLUMN IF NOT EXISTS part_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS evaluator_type VARCHAR(20) DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS model_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS model_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS rubric_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS raw_score NUMERIC,
  ADD COLUMN IF NOT EXISTS max_score NUMERIC,
  ADD COLUMN IF NOT EXISTS normalized_score NUMERIC,
  ADD COLUMN IF NOT EXISTS cefr_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS rubric_result JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strengths JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS improvements JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS usage_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_evaluation_id UUID;

-- 1.3 Backfill legacy rows
UPDATE public.practice_response_evaluations e
SET 
  attempt_id = r.attempt_id,
  question_id = r.question_id,
  skill = q.skill,
  part_number = q.part_number,
  status = CASE WHEN e.evaluation_status = 'evaluated' THEN 'completed' ELSE COALESCE(e.status, 'pending') END
FROM public.practice_responses r
JOIN public.aptis_questions q ON q.id = r.question_id
WHERE e.response_id = r.id AND e.attempt_id IS NULL;

-- 1.4 Primary key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'practice_response_evaluations' AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public.practice_response_evaluations ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 1.5 Self-reference FK for versioning
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_evaluations_supersedes'
  ) THEN
    ALTER TABLE public.practice_response_evaluations
      ADD CONSTRAINT fk_evaluations_supersedes
      FOREIGN KEY (supersedes_evaluation_id) 
      REFERENCES public.practice_response_evaluations(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- 1.6 Constraints Alignment
ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS chk_eval_status_values,
  ADD CONSTRAINT chk_eval_status_values CHECK (status IN ('pending', 'processing', 'needs_review', 'completed', 'failed'));

ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS chk_evaluator_type_values,
  ADD CONSTRAINT chk_evaluator_type_values CHECK (evaluator_type IN ('ai', 'human'));

ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS chk_eval_normalized_score_range,
  ADD CONSTRAINT chk_eval_normalized_score_range CHECK (normalized_score IS NULL OR (normalized_score >= 0 AND normalized_score <= 100));

ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS chk_eval_completed_max_score,
  ADD CONSTRAINT chk_eval_completed_max_score CHECK (status != 'completed' OR (max_score IS NOT NULL AND max_score > 0));

ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS chk_eval_cefr_level,
  ADD CONSTRAINT chk_eval_cefr_level CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- 1.7 Partial Unique Index for Active Job Idempotency
DROP INDEX IF EXISTS idx_active_evaluation_per_response;
CREATE UNIQUE INDEX idx_active_evaluation_per_response 
  ON public.practice_response_evaluations(response_id) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_practice_evaluations_response_ver 
  ON public.practice_response_evaluations(response_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_practice_evaluations_attempt 
  ON public.practice_response_evaluations(attempt_id);

-- ----------------------------------------------------------------------------
-- 2. DURABLE ATOMIC JOB CLAIMING & STUCK JOB RECOVERY RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- 2.1 Atomic Job Claiming RPC
CREATE OR REPLACE FUNCTION public.claim_next_pending_evaluation(p_worker_id TEXT DEFAULT 'worker_node')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Claim next pending job atomically using FOR UPDATE SKIP LOCKED
  SELECT * INTO v_job
  FROM public.practice_response_evaluations
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.practice_response_evaluations
  SET 
    status = 'processing',
    started_at = NOW(),
    usage_metadata = jsonb_set(COALESCE(usage_metadata, '{}'::jsonb), '{claimed_by}', to_jsonb(p_worker_id))
  WHERE id = v_job.id;

  RETURN jsonb_build_object(
    'evaluation_id', v_job.id,
    'attempt_id', v_job.attempt_id,
    'response_id', v_job.response_id,
    'question_id', v_job.question_id,
    'skill', v_job.skill,
    'part_number', v_job.part_number,
    'version', v_job.version
  );
END;
$$;

-- 2.2 Stuck Processing Job Recovery RPC (5-minute timeout reset)
CREATE OR REPLACE FUNCTION public.recover_stuck_evaluation_jobs(p_timeout_minutes INT DEFAULT 5)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recovered_count INT := 0;
BEGIN
  WITH reset_rows AS (
    UPDATE public.practice_response_evaluations
    SET 
      status = 'pending',
      error_message = 'Job execution timed out. Reset to pending by recovery worker.'
    WHERE status = 'processing' 
      AND started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_recovered_count FROM reset_rows;

  RETURN v_recovered_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. PRIVATE STORAGE BUCKET & DUAL CHECK RLS POLICIES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'speaking-recordings',
  'speaking-recordings',
  false, -- STRICTLY PRIVATE BUCKET
  false,
  20971520, -- 20MB limit
  ARRAY['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/x-m4a']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/x-m4a'];

-- RLS policies: Check BOTH auth.uid() = owner AND folder path = auth.uid()::text
DROP POLICY IF EXISTS "Owner read access for speaking recordings" ON storage.objects;
CREATE POLICY "Owner read access for speaking recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'speaking-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Owner insert access for speaking recordings" ON storage.objects;
CREATE POLICY "Owner insert access for speaking recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'speaking-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Owner update access for speaking recordings" ON storage.objects;
CREATE POLICY "Owner update access for speaking recordings"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'speaking-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Owner delete access for speaking recordings" ON storage.objects;
CREATE POLICY "Owner delete access for speaking recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'speaking-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (owner = auth.uid() OR owner_id = auth.uid()::text)
  );

-- ----------------------------------------------------------------------------
-- 4. UPDATE DASHBOARD STATS RPC FUNCTION FOR COMPATIBILITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  
  v_listening_completed INT := 0;
  v_reading_completed INT := 0;
  v_writing_completed INT := 0;
  v_speaking_completed INT := 0;
  
  v_listening_percent INT := 0;
  v_reading_percent INT := 0;
  v_writing_percent INT := 0;
  v_speaking_percent INT := 0;
  
  v_overall_completed INT := 0;
  v_overall_percent INT := 0;
  
  v_l_score INT := NULL;
  v_l_eval_status VARCHAR(20) := NULL;
  v_l_attempt_id UUID := NULL;
  v_l_completed_at TIMESTAMPTZ := NULL;

  v_r_score INT := NULL;
  v_r_eval_status VARCHAR(20) := NULL;
  v_r_attempt_id UUID := NULL;
  v_r_completed_at TIMESTAMPTZ := NULL;

  v_w_score INT := NULL;
  v_w_eval_status VARCHAR(20) := NULL;
  v_w_attempt_id UUID := NULL;
  v_w_completed_at TIMESTAMPTZ := NULL;

  v_s_score INT := NULL;
  v_s_eval_status VARCHAR(20) := NULL;
  v_s_attempt_id UUID := NULL;
  v_s_completed_at TIMESTAMPTZ := NULL;

  v_overall_latest_score INT := NULL;
  v_overall_latest_skill VARCHAR(50) := NULL;

  v_today DATE;
  v_check_date DATE;
  v_streak INT := 0;
  v_has_today BOOLEAN := FALSE;
  
  v_rec RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Completed Parts Calculation
  SELECT COUNT(DISTINCT p) INTO v_listening_completed
  FROM (
    SELECT part_number AS p FROM public.practice_attempts
    WHERE user_id = v_user_id AND skill = 'listening' AND status IN ('submitted', 'completed') AND part_number IS NOT NULL
  ) sub WHERE p IN (1, 2, 3, 4);

  SELECT COUNT(DISTINCT p) INTO v_reading_completed
  FROM (
    SELECT part_number AS p FROM public.practice_attempts
    WHERE user_id = v_user_id AND skill = 'reading' AND status IN ('submitted', 'completed') AND part_number IS NOT NULL
  ) sub WHERE p IN (1, 2, 3, 4);

  SELECT COUNT(DISTINCT p) INTO v_writing_completed
  FROM (
    SELECT part_number AS p FROM public.practice_attempts
    WHERE user_id = v_user_id AND skill = 'writing' AND status IN ('submitted', 'completed') AND part_number IS NOT NULL
  ) sub WHERE p IN (1, 2, 3, 4);

  SELECT COUNT(DISTINCT p) INTO v_speaking_completed
  FROM (
    SELECT part_number AS p FROM public.practice_attempts
    WHERE user_id = v_user_id AND skill = 'speaking' AND status IN ('submitted', 'completed') AND part_number IS NOT NULL
  ) sub WHERE p IN (1, 2, 3, 4);

  v_listening_completed := LEAST(4, GREATEST(0, v_listening_completed));
  v_reading_completed := LEAST(4, GREATEST(0, v_reading_completed));
  v_writing_completed := LEAST(4, GREATEST(0, v_writing_completed));
  v_speaking_completed := LEAST(4, GREATEST(0, v_speaking_completed));

  v_listening_percent := ROUND((v_listening_completed::numeric / 4.0) * 100);
  v_reading_percent := ROUND((v_reading_completed::numeric / 4.0) * 100);
  v_writing_percent := ROUND((v_writing_completed::numeric / 4.0) * 100);
  v_speaking_percent := ROUND((v_speaking_completed::numeric / 4.0) * 100);

  v_overall_completed := v_listening_completed + v_reading_completed + v_writing_completed + v_speaking_completed;
  v_overall_percent := ROUND((v_overall_completed::numeric / 16.0) * 100);

  -- 2. Latest Scores Calculation
  -- 2.1 Listening
  SELECT a.id, a.total_score, a.submitted_at INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id AND a.skill = 'listening' AND a.status IN ('submitted', 'completed')
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC LIMIT 1;

  IF FOUND THEN
    v_l_attempt_id := v_rec.id;
    v_l_completed_at := v_rec.submitted_at;
    v_l_score := v_rec.total_score;
    v_l_eval_status := 'completed';
  END IF;

  -- 2.2 Reading
  SELECT a.id, a.total_score, a.submitted_at INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id AND a.skill = 'reading' AND a.status IN ('submitted', 'completed')
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC LIMIT 1;

  IF FOUND THEN
    v_r_attempt_id := v_rec.id;
    v_r_completed_at := v_rec.submitted_at;
    v_r_score := v_rec.total_score;
    v_r_eval_status := 'completed';
  END IF;

  -- 2.3 Writing: Query practice_response_evaluations directly for real normalized_score
  SELECT a.id AS attempt_id, e.status, e.normalized_score, e.completed_at
  INTO v_rec
  FROM public.practice_attempts a
  JOIN public.practice_response_evaluations e ON e.attempt_id = a.id
  WHERE a.user_id = v_user_id AND a.skill = 'writing' AND a.status IN ('submitted', 'completed')
  ORDER BY e.created_at DESC LIMIT 1;

  IF FOUND THEN
    v_w_attempt_id := v_rec.attempt_id;
    v_w_completed_at := v_rec.completed_at;
    v_w_eval_status := v_rec.status;
    IF v_rec.status = 'completed' THEN
      v_w_score := LEAST(100, GREATEST(0, ROUND(v_rec.normalized_score)));
    ELSE
      v_w_score := NULL;
    END IF;
  END IF;

  -- 2.4 Speaking: Query practice_response_evaluations directly for real normalized_score
  SELECT a.id AS attempt_id, e.status, e.normalized_score, e.completed_at
  INTO v_rec
  FROM public.practice_attempts a
  JOIN public.practice_response_evaluations e ON e.attempt_id = a.id
  WHERE a.user_id = v_user_id AND a.skill = 'speaking' AND a.status IN ('submitted', 'completed')
  ORDER BY e.created_at DESC LIMIT 1;

  IF FOUND THEN
    v_s_attempt_id := v_rec.attempt_id;
    v_s_completed_at := v_rec.completed_at;
    v_s_eval_status := v_rec.status;
    IF v_rec.status = 'completed' THEN
      v_s_score := LEAST(100, GREATEST(0, ROUND(v_rec.normalized_score)));
    ELSE
      v_s_score := NULL;
    END IF;
  END IF;

  -- 3. Streak Calculation
  v_today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  SELECT EXISTS (
    SELECT 1 FROM public.practice_attempts
    WHERE user_id = v_user_id AND status IN ('submitted', 'completed') AND (submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_today
  ) INTO v_has_today;

  IF v_has_today THEN v_check_date := v_today; ELSE v_check_date := v_today - 1; END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.practice_attempts
    WHERE user_id = v_user_id AND status IN ('submitted', 'completed') AND (submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_check_date
  ) LOOP
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  END LOOP;

  RETURN jsonb_build_object(
    'overall', jsonb_build_object(
      'completedParts', v_overall_completed,
      'totalParts', 16,
      'progressPercent', v_overall_percent,
      'latestScore', COALESCE(v_w_score, v_s_score, v_r_score, v_l_score),
      'latestSkill', CASE WHEN v_w_score IS NOT NULL THEN 'writing' WHEN v_s_score IS NOT NULL THEN 'speaking' ELSE 'reading' END,
      'cefrLevel', NULL,
      'studyStreakDays', v_streak
    ),
    'skills', jsonb_build_object(
      'listening', jsonb_build_object(
        'completedParts', v_listening_completed,
        'totalParts', 4,
        'progressPercent', v_listening_percent,
        'latestScore', v_l_score,
        'maxScore', 100,
        'cefrLevel', NULL,
        'evaluationStatus', v_l_eval_status,
        'latestAttemptId', v_l_attempt_id,
        'latestCompletedAt', v_l_completed_at
      ),
      'reading', jsonb_build_object(
        'completedParts', v_reading_completed,
        'totalParts', 4,
        'progressPercent', v_reading_percent,
        'latestScore', v_r_score,
        'maxScore', 100,
        'cefrLevel', NULL,
        'evaluationStatus', v_r_eval_status,
        'latestAttemptId', v_r_attempt_id,
        'latestCompletedAt', v_r_completed_at
      ),
      'writing', jsonb_build_object(
        'completedParts', v_writing_completed,
        'totalParts', 4,
        'progressPercent', v_writing_percent,
        'latestScore', v_w_score,
        'maxScore', 100,
        'cefrLevel', NULL,
        'evaluationStatus', v_w_eval_status,
        'latestAttemptId', v_w_attempt_id,
        'latestCompletedAt', v_w_completed_at
      ),
      'speaking', jsonb_build_object(
        'completedParts', v_speaking_completed,
        'totalParts', 4,
        'progressPercent', v_speaking_percent,
        'latestScore', v_s_score,
        'maxScore', 100,
        'cefrLevel', NULL,
        'evaluationStatus', v_s_eval_status,
        'latestAttemptId', v_s_attempt_id,
        'latestCompletedAt', v_s_completed_at
      )
    )
  );
END;
$$;
