-- ============================================================================
-- Migration: Public / Authenticated RLS Select Policy for Practice Response Evaluations
-- File: supabase/migrations/20260920000000_enable_evaluations_rls.sql
-- Scope: Allows practice users (authenticated) to read AI evaluation records for their own attempts
-- ============================================================================

ALTER TABLE IF EXISTS public.practice_response_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read evaluations for their attempts" ON public.practice_response_evaluations;

CREATE POLICY "Users can read evaluations for their attempts"
  ON public.practice_response_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.practice_attempts a
      WHERE a.id = practice_response_evaluations.attempt_id
        AND a.user_id = auth.uid()
    )
  );
