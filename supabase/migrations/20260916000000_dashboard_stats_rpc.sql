-- ============================================================================
-- Migration: Phase Dashboard Statistics RPC Function
-- File: supabase/migrations/20260916000000_dashboard_stats_rpc.sql
-- Created at: 2026-09-16
-- Scope: Secure user isolated dashboard statistics calculation via RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  
  -- Overall variables
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
  
  -- Latest score per skill
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

  -- Overall latest test score
  v_overall_latest_score INT := NULL;
  v_overall_latest_skill VARCHAR(50) := NULL;

  -- Streak variables
  v_today DATE;
  v_check_date DATE;
  v_streak INT := 0;
  v_has_today BOOLEAN := FALSE;
  
  -- Record helpers
  v_rec RECORD;
  v_denom INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. CALCULATE COMPLETED PARTS PER SKILL
  -- --------------------------------------------------------------------------

  -- 1.1 Listening (4 UI Parts: Part 1, Part 2, Part 3, Part 4)
  SELECT COUNT(DISTINCT p) INTO v_listening_completed
  FROM (
    SELECT part_number AS p
    FROM public.practice_attempts
    WHERE user_id = v_user_id
      AND skill = 'listening'
      AND status IN ('submitted', 'completed')
      AND part_number IS NOT NULL
    UNION
    SELECT q.part_number AS p
    FROM public.practice_attempts a
    JOIN public.practice_responses r ON r.attempt_id = a.id
    JOIN public.aptis_questions q ON q.id = r.question_id
    WHERE a.user_id = v_user_id
      AND a.skill = 'listening'
      AND a.status IN ('submitted', 'completed')
  ) sub
  WHERE p IN (1, 2, 3, 4);

  -- 1.2 Reading (4 UI Units: Part 1, Part 2-3 unified, Part 4, Part 5)
  WITH reading_parts AS (
    SELECT part_number AS p
    FROM public.practice_attempts
    WHERE user_id = v_user_id
      AND skill = 'reading'
      AND status IN ('submitted', 'completed')
      AND part_number IS NOT NULL
    UNION
    SELECT q.part_number AS p
    FROM public.practice_attempts a
    JOIN public.practice_responses r ON r.attempt_id = a.id
    JOIN public.aptis_questions q ON q.id = r.question_id
    WHERE a.user_id = v_user_id
      AND a.skill = 'reading'
      AND a.status IN ('submitted', 'completed')
  )
  SELECT 
    (CASE WHEN EXISTS (SELECT 1 FROM reading_parts WHERE p = 1) THEN 1 ELSE 0 END) +
    (CASE WHEN EXISTS (SELECT 1 FROM reading_parts WHERE p IN (2, 3)) THEN 1 ELSE 0 END) +
    (CASE WHEN EXISTS (SELECT 1 FROM reading_parts WHERE p = 4) THEN 1 ELSE 0 END) +
    (CASE WHEN EXISTS (SELECT 1 FROM reading_parts WHERE p = 5) THEN 1 ELSE 0 END)
  INTO v_reading_completed;

  -- 1.3 Writing (4 UI Parts: Part 1, Part 2, Part 3, Part 4)
  SELECT COUNT(DISTINCT p) INTO v_writing_completed
  FROM (
    SELECT part_number AS p
    FROM public.practice_attempts
    WHERE user_id = v_user_id
      AND skill = 'writing'
      AND status IN ('submitted', 'completed')
      AND part_number IS NOT NULL
    UNION
    SELECT q.part_number AS p
    FROM public.practice_attempts a
    JOIN public.practice_responses r ON r.attempt_id = a.id
    JOIN public.aptis_questions q ON q.id = r.question_id
    WHERE a.user_id = v_user_id
      AND a.skill = 'writing'
      AND a.status IN ('submitted', 'completed')
  ) sub
  WHERE p IN (1, 2, 3, 4);

  -- 1.4 Speaking (4 UI Parts: Part 1, Part 2, Part 3, Part 4)
  SELECT COUNT(DISTINCT p) INTO v_speaking_completed
  FROM (
    SELECT part_number AS p
    FROM public.practice_attempts
    WHERE user_id = v_user_id
      AND skill = 'speaking'
      AND status IN ('submitted', 'completed')
      AND part_number IS NOT NULL
    UNION
    SELECT q.part_number AS p
    FROM public.practice_attempts a
    JOIN public.practice_responses r ON r.attempt_id = a.id
    JOIN public.aptis_questions q ON q.id = r.question_id
    WHERE a.user_id = v_user_id
      AND a.skill = 'speaking'
      AND a.status IN ('submitted', 'completed')
  ) sub
  WHERE p IN (1, 2, 3, 4);

  -- Sanitize counts to max 4
  v_listening_completed := LEAST(4, GREATEST(0, v_listening_completed));
  v_reading_completed := LEAST(4, GREATEST(0, v_reading_completed));
  v_writing_completed := LEAST(4, GREATEST(0, v_writing_completed));
  v_speaking_completed := LEAST(4, GREATEST(0, v_speaking_completed));

  -- Percentages per skill
  v_listening_percent := ROUND((v_listening_completed::numeric / 4.0) * 100);
  v_reading_percent := ROUND((v_reading_completed::numeric / 4.0) * 100);
  v_writing_percent := ROUND((v_writing_completed::numeric / 4.0) * 100);
  v_speaking_percent := ROUND((v_speaking_completed::numeric / 4.0) * 100);

  -- Overall totals
  v_overall_completed := v_listening_completed + v_reading_completed + v_writing_completed + v_speaking_completed;
  v_overall_percent := ROUND((v_overall_completed::numeric / 16.0) * 100);

  -- --------------------------------------------------------------------------
  -- 2. CALCULATE LATEST SCORE PER SKILL
  -- --------------------------------------------------------------------------

  -- 2.1 Listening Latest Score
  SELECT a.id, a.total_score, a.status, a.submitted_at,
         (SELECT COUNT(*) FROM public.practice_responses r WHERE r.attempt_id = a.id) AS resp_count
  INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id AND a.skill = 'listening' AND a.status IN ('submitted', 'completed')
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC
  LIMIT 1;

  IF FOUND THEN
    v_l_attempt_id := v_rec.id;
    v_l_completed_at := v_rec.submitted_at;
    IF v_rec.total_score IS NOT NULL THEN
      v_l_eval_status := 'completed';
      v_denom := GREATEST(1, v_rec.resp_count);
      IF v_rec.total_score <= v_denom THEN
        v_l_score := LEAST(100, GREATEST(0, ROUND((v_rec.total_score / v_denom::numeric) * 100)));
      ELSE
        v_l_score := LEAST(100, GREATEST(0, ROUND(v_rec.total_score)));
      END IF;
    ELSE
      v_l_eval_status := 'pending';
    END IF;
  END IF;

  -- 2.2 Reading Latest Score
  SELECT a.id, a.total_score, a.status, a.submitted_at,
         (SELECT COUNT(*) FROM public.practice_responses r WHERE r.attempt_id = a.id) AS resp_count
  INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id AND a.skill = 'reading' AND a.status IN ('submitted', 'completed')
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC
  LIMIT 1;

  IF FOUND THEN
    v_r_attempt_id := v_rec.id;
    v_r_completed_at := v_rec.submitted_at;
    IF v_rec.total_score IS NOT NULL THEN
      v_r_eval_status := 'completed';
      v_denom := GREATEST(1, v_rec.resp_count);
      IF v_rec.total_score <= v_denom THEN
        v_r_score := LEAST(100, GREATEST(0, ROUND((v_rec.total_score / v_denom::numeric) * 100)));
      ELSE
        v_r_score := LEAST(100, GREATEST(0, ROUND(v_rec.total_score)));
      END IF;
    ELSE
      v_r_eval_status := 'pending';
    END IF;
  END IF;

  -- 2.3 Writing Latest Score
  SELECT a.id, a.total_score, a.status, a.submitted_at,
         (SELECT COUNT(*) FROM public.practice_responses r WHERE r.attempt_id = a.id) AS resp_count
  INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id AND a.skill = 'writing' AND a.status IN ('submitted', 'completed')
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC
  LIMIT 1;

  IF FOUND THEN
    v_w_attempt_id := v_rec.id;
    v_w_completed_at := v_rec.submitted_at;
    IF v_rec.total_score IS NOT NULL THEN
      v_w_eval_status := 'completed';
      v_denom := GREATEST(1, v_rec.resp_count);
      IF v_rec.total_score <= v_denom THEN
        v_w_score := LEAST(100, GREATEST(0, ROUND((v_rec.total_score / v_denom::numeric) * 100)));
      ELSE
        v_w_score := LEAST(100, GREATEST(0, ROUND(v_rec.total_score)));
      END IF;
    ELSE
      v_w_eval_status := 'pending';
    END IF;
  END IF;

  -- 2.4 Speaking Latest Score
  SELECT a.id, a.total_score, a.status, a.submitted_at,
         (SELECT COUNT(*) FROM public.practice_responses r WHERE r.attempt_id = a.id) AS resp_count
  INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id AND a.skill = 'speaking' AND a.status IN ('submitted', 'completed')
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC
  LIMIT 1;

  IF FOUND THEN
    v_s_attempt_id := v_rec.id;
    v_s_completed_at := v_rec.submitted_at;
    IF v_rec.total_score IS NOT NULL THEN
      v_s_eval_status := 'completed';
      v_denom := GREATEST(1, v_rec.resp_count);
      IF v_rec.total_score <= v_denom THEN
        v_s_score := LEAST(100, GREATEST(0, ROUND((v_rec.total_score / v_denom::numeric) * 100)));
      ELSE
        v_s_score := LEAST(100, GREATEST(0, ROUND(v_rec.total_score)));
      END IF;
    ELSE
      v_s_eval_status := 'pending';
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. CALCULATE OVERALL LATEST TEST SCORE (Across all skills)
  -- --------------------------------------------------------------------------
  SELECT a.skill, a.total_score,
         (SELECT COUNT(*) FROM public.practice_responses r WHERE r.attempt_id = a.id) AS resp_count
  INTO v_rec
  FROM public.practice_attempts a
  WHERE a.user_id = v_user_id
    AND a.status IN ('submitted', 'completed')
    AND a.total_score IS NOT NULL
  ORDER BY COALESCE(a.submitted_at, a.updated_at, a.started_at) DESC
  LIMIT 1;

  IF FOUND THEN
    v_overall_latest_skill := v_rec.skill;
    v_denom := GREATEST(1, v_rec.resp_count);
    IF v_rec.total_score <= v_denom THEN
      v_overall_latest_score := LEAST(100, GREATEST(0, ROUND((v_rec.total_score / v_denom::numeric) * 100)));
    ELSE
      v_overall_latest_score := LEAST(100, GREATEST(0, ROUND(v_rec.total_score)));
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 4. CALCULATE STUDY STREAK (Asia/Ho_Chi_Minh Timezone)
  -- --------------------------------------------------------------------------
  v_today := (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  
  -- Check if user has an active submitted/completed attempt on v_today
  SELECT EXISTS (
    SELECT 1 FROM public.practice_attempts
    WHERE user_id = v_user_id
      AND status IN ('submitted', 'completed')
      AND (submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_today
  ) INTO v_has_today;

  IF v_has_today THEN
    v_check_date := v_today;
  ELSE
    v_check_date := v_today - 1;
  END IF;

  WHILE EXISTS (
    SELECT 1 FROM public.practice_attempts
    WHERE user_id = v_user_id
      AND status IN ('submitted', 'completed')
      AND (submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = v_check_date
  ) LOOP
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 5. BUILD AND RETURN JSON PAYLOAD
  -- --------------------------------------------------------------------------
  RETURN jsonb_build_object(
    'overall', jsonb_build_object(
      'completedParts', v_overall_completed,
      'totalParts', 16,
      'progressPercent', v_overall_percent,
      'latestScore', v_overall_latest_score,
      'latestSkill', v_overall_latest_skill,
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

-- Security Hardening
REVOKE ALL ON FUNCTION public.get_user_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats() TO authenticated;
