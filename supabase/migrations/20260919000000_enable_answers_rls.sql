-- ============================================================================
-- Migration: Public RLS Select Policy for Aptis Question Answers
-- File: supabase/migrations/20260919000000_enable_answers_rls.sql
-- Scope: Allows practice users (authenticated & anon) to read correct_answer and explanation
-- ============================================================================

ALTER TABLE IF EXISTS public.aptis_question_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read Aptis question answers" ON public.aptis_question_answers;
DROP POLICY IF EXISTS "Public users can read Aptis question answers" ON public.aptis_question_answers;

CREATE POLICY "Public users can read Aptis question answers" 
  ON public.aptis_question_answers 
  FOR SELECT TO public 
  USING (true);

