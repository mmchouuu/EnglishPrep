-- ============================================================================
-- Migration: Supplementary RLS Policies for Phase 5 (Data Access & Secure API)
-- File: supabase/migrations/20260911000000_supplementary_rls_phase5.sql
-- Created at: 2026-09-11
-- Scope: Phase 0 Alignment - Authenticated-only public question access & Edge Function submission security
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PUBLIC QUESTION BANK READ ACCESS (STRICTLY AUTHENTICATED ONLY)
-- Per Phase 0 rules: Only authenticated users can read Aptis question bank data.
-- Anon users DO NOT have SELECT access.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public and authenticated users can read Aptis groups" ON public.aptis_groups;
DROP POLICY IF EXISTS "Public and authenticated users can read Aptis content blocks" ON public.aptis_content_blocks;
DROP POLICY IF EXISTS "Public and authenticated users can read Aptis questions" ON public.aptis_questions;
DROP POLICY IF EXISTS "Public and authenticated users can read Aptis question groups" ON public.aptis_question_groups;
DROP POLICY IF EXISTS "Public and authenticated users can read Aptis question content blocks" ON public.aptis_question_content_blocks;
DROP POLICY IF EXISTS "Public and authenticated users can read Aptis question options" ON public.aptis_question_options;

-- ----------------------------------------------------------------------------
-- 2. PRACTICE ATTEMPTS SECURITY RESTRICTIONS
-- Frontend client CANNOT freely UPDATE practice_attempts to alter total_score,
-- status = 'submitted', or submitted_at. Attempt finalization occurs strictly
-- inside the Supabase Edge Function (submit-practice) using Service Role context.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own practice attempts" ON public.practice_attempts;

-- ----------------------------------------------------------------------------
-- 3. PRACTICE RESPONSES AUTOSAVE POLICY (IN-PROGRESS ATTEMPTS ONLY)
-- Authenticated users can insert and update their responses ONLY while the parent
-- practice_attempt status is 'in_progress'. Client cannot modify responses after submission.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update responses for in-progress attempts" ON public.practice_responses;
CREATE POLICY "Users can update responses for in-progress attempts" ON public.practice_responses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.practice_attempts a 
      WHERE a.id = practice_responses.attempt_id 
        AND a.user_id = auth.uid() 
        AND a.status = 'in_progress'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.practice_attempts a 
      WHERE a.id = practice_responses.attempt_id 
        AND a.user_id = auth.uid() 
        AND a.status = 'in_progress'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. PRIVATE TABLES REMAIN UNEXPOSED TO CLIENT ROLES
-- - aptis_question_answers (Private solutions / correct answers)
-- - practice_response_evaluations (Private AI evaluations / scores)
-- - aptis_import_runs (Audit log)
-- Access is strictly restricted to Supabase Edge Function (Service Role).
-- ----------------------------------------------------------------------------
