-- ============================================================================
-- Migration: Create Aptis Practice Application Database Foundation (Refactored)
-- File: supabase/migrations/20260910000000_create_aptis_system.sql
-- Created at: 2026-09-10
-- Scope: 4 Skills ('reading', 'listening', 'speaking', 'writing')
-- Total Tables: 12 Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CUSTOM ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ 
BEGIN
  IF to_regtype('public.aptis_skill_enum') IS NULL THEN
    CREATE TYPE public.aptis_skill_enum AS ENUM ('reading', 'listening', 'speaking', 'writing');
  END IF;
  
  IF to_regtype('public.aptis_question_status_enum') IS NULL THEN
    CREATE TYPE public.aptis_question_status_enum AS ENUM ('imported', 'updated');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TRIGGER FUNCTION FOR AUTOMATIC UPDATED_AT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_aptis_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. TABLES DEFINITION (12 TABLES)
-- ----------------------------------------------------------------------------

-- 3.1. Groups (Clubs, Topics, Practice Sets)
CREATE TABLE IF NOT EXISTS public.aptis_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill public.aptis_skill_enum NOT NULL,
  group_type VARCHAR(50) NOT NULL CHECK (group_type IN ('club', 'topic', 'practice_set', 'core_story', 'module')),
  group_key VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_aptis_groups_skill_type_key UNIQUE (skill, group_type, group_key)
);

-- 3.2. Content Blocks (Passages, Audio, Images, Instructions)
CREATE TABLE IF NOT EXISTS public.aptis_content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill public.aptis_skill_enum NOT NULL,
  block_type VARCHAR(50) NOT NULL CHECK (block_type IN ('passage', 'audio', 'image', 'instructions', 'conversation')),
  source_key VARCHAR(100) NOT NULL,
  title TEXT,
  content TEXT,
  media_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_aptis_content_blocks_skill_key UNIQUE (skill, source_key)
);

-- 3.3. Questions Master Table
CREATE TABLE IF NOT EXISTS public.aptis_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill public.aptis_skill_enum NOT NULL,
  part_number INT NOT NULL CHECK (part_number > 0),
  question_type VARCHAR(50) NOT NULL CHECK (
    question_type IN (
      'multiple_choice',
      'dropdown',
      'sentence_ordering',
      'heading_matching',
      'opinion_matching',
      'text_input',
      'email_writing',
      'photo_description',
      'photo_comparison',
      'speaking_recording',
      'listening_multiple_choice',
      'listening_matching'
    )
  ),
  source_key VARCHAR(100) NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_hash VARCHAR(64) NOT NULL,
  import_status public.aptis_question_status_enum NOT NULL DEFAULT 'imported',
  first_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_aptis_questions_skill_source_key UNIQUE (skill, source_key)
);

-- 3.4. Question-Group Junction
CREATE TABLE IF NOT EXISTS public.aptis_question_groups (
  question_id UUID REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.aptis_groups(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  PRIMARY KEY (question_id, group_id)
);

-- 3.5. Question-ContentBlock Junction
CREATE TABLE IF NOT EXISTS public.aptis_question_content_blocks (
  question_id UUID REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  content_block_id UUID REFERENCES public.aptis_content_blocks(id) ON DELETE CASCADE,
  content_role VARCHAR(50) NOT NULL CHECK (content_role IN ('passage', 'audio', 'image_1', 'image_2', 'instructions', 'conversation')),
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  PRIMARY KEY (question_id, content_block_id, content_role)
);

-- 3.6. Question Options
CREATE TABLE IF NOT EXISTS public.aptis_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  option_key VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_aptis_question_options_q_key UNIQUE (question_id, option_key)
);

-- 3.7. Question Solutions & Answers (PRIVATE - Restricted from direct frontend access)
CREATE TABLE IF NOT EXISTS public.aptis_question_answers (
  question_id UUID PRIMARY KEY REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  correct_answer JSONB,
  explanation TEXT,
  model_answer TEXT,
  rubric JSONB,
  solution_data JSONB, -- Contains transcripts, detailed analysis
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8. Practice Attempts (User Sessions)
CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill public.aptis_skill_enum NOT NULL,
  practice_mode VARCHAR(50) NOT NULL CHECK (practice_mode IN ('full_skill', 'by_part', 'by_club', 'by_topic')),
  part_number INT CHECK (part_number IS NULL OR part_number > 0),
  group_id UUID REFERENCES public.aptis_groups(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'evaluating', 'completed', 'abandoned')),
  total_score NUMERIC CHECK (total_score IS NULL OR total_score >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ CHECK (submitted_at IS NULL OR submitted_at >= started_at),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9. Practice User Responses (User Inputs Only)
CREATE TABLE IF NOT EXISTS public.practice_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.practice_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  response JSONB,
  word_count INT CHECK (word_count IS NULL OR word_count >= 0),
  recording_path TEXT,
  speech_transcript TEXT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_practice_responses_attempt_question UNIQUE (attempt_id, question_id)
);

-- 3.10. Practice Response Evaluations (Backend/AI Evaluation Only - PRIVATE)
CREATE TABLE IF NOT EXISTS public.practice_response_evaluations (
  response_id UUID PRIMARY KEY REFERENCES public.practice_responses(id) ON DELETE CASCADE,
  is_correct BOOLEAN,
  score NUMERIC CHECK (score IS NULL OR score >= 0),
  ai_feedback JSONB,
  evaluation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (evaluation_status IN ('pending', 'evaluated', 'failed')),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11. User Bookmarks
CREATE TABLE IF NOT EXISTS public.question_bookmarks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.aptis_questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- 3.12. Import Runs Audit Log
CREATE TABLE IF NOT EXISTS public.aptis_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file VARCHAR(255) NOT NULL,
  skill public.aptis_skill_enum NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  total_parsed INT NOT NULL DEFAULT 0 CHECK (total_parsed >= 0),
  inserted_count INT NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
  updated_count INT NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
  unchanged_count INT NOT NULL DEFAULT 0 CHECK (unchanged_count >= 0),
  error_count INT NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ CHECK (completed_at IS NULL OR completed_at >= started_at),
  error_message TEXT
);

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS FOR AUTOMATIC UPDATED_AT
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_aptis_groups_updated_at ON public.aptis_groups;
CREATE TRIGGER trg_aptis_groups_updated_at BEFORE UPDATE ON public.aptis_groups FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

DROP TRIGGER IF EXISTS trg_aptis_content_blocks_updated_at ON public.aptis_content_blocks;
CREATE TRIGGER trg_aptis_content_blocks_updated_at BEFORE UPDATE ON public.aptis_content_blocks FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

DROP TRIGGER IF EXISTS trg_aptis_questions_updated_at ON public.aptis_questions;
CREATE TRIGGER trg_aptis_questions_updated_at BEFORE UPDATE ON public.aptis_questions FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

DROP TRIGGER IF EXISTS trg_aptis_question_answers_updated_at ON public.aptis_question_answers;
CREATE TRIGGER trg_aptis_question_answers_updated_at BEFORE UPDATE ON public.aptis_question_answers FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

DROP TRIGGER IF EXISTS trg_practice_attempts_updated_at ON public.practice_attempts;
CREATE TRIGGER trg_practice_attempts_updated_at BEFORE UPDATE ON public.practice_attempts FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

DROP TRIGGER IF EXISTS trg_practice_responses_updated_at ON public.practice_responses;
CREATE TRIGGER trg_practice_responses_updated_at BEFORE UPDATE ON public.practice_responses FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

DROP TRIGGER IF EXISTS trg_practice_response_evaluations_updated_at ON public.practice_response_evaluations;
CREATE TRIGGER trg_practice_response_evaluations_updated_at BEFORE UPDATE ON public.practice_response_evaluations FOR EACH ROW EXECUTE FUNCTION public.set_aptis_updated_at();

-- ----------------------------------------------------------------------------
-- 5. INDEXES FOR QUERY OPTIMIZATION
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_aptis_questions_skill_part_order ON public.aptis_questions(skill, part_number, display_order);
CREATE INDEX IF NOT EXISTS idx_aptis_groups_skill_type_order ON public.aptis_groups(skill, group_type, display_order);
CREATE INDEX IF NOT EXISTS idx_aptis_question_groups_group_order ON public.aptis_question_groups(group_id, display_order);
CREATE INDEX IF NOT EXISTS idx_aptis_question_content_blocks_q_order ON public.aptis_question_content_blocks(question_id, display_order);
CREATE INDEX IF NOT EXISTS idx_aptis_question_content_blocks_content ON public.aptis_question_content_blocks(content_block_id);
CREATE INDEX IF NOT EXISTS idx_aptis_question_options_q_order ON public.aptis_question_options(question_id, display_order);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_status_date ON public.practice_attempts(user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_group ON public.practice_attempts(group_id);
CREATE INDEX IF NOT EXISTS idx_practice_responses_question ON public.practice_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_question_bookmarks_user_date ON public.question_bookmarks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bookmarks_question ON public.question_bookmarks(question_id);
CREATE INDEX IF NOT EXISTS idx_aptis_import_runs_started_at ON public.aptis_import_runs(started_at DESC);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.aptis_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_question_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_response_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptis_import_runs ENABLE ROW LEVEL SECURITY;

-- 6.1. Public Question Bank Read Policies (Authenticated Users)
DROP POLICY IF EXISTS "Authenticated users can read Aptis groups" ON public.aptis_groups;
CREATE POLICY "Authenticated users can read Aptis groups" ON public.aptis_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read Aptis content blocks" ON public.aptis_content_blocks;
CREATE POLICY "Authenticated users can read Aptis content blocks" ON public.aptis_content_blocks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read Aptis questions" ON public.aptis_questions;
CREATE POLICY "Authenticated users can read Aptis questions" ON public.aptis_questions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read Aptis question groups" ON public.aptis_question_groups;
CREATE POLICY "Authenticated users can read Aptis question groups" ON public.aptis_question_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read Aptis question content blocks" ON public.aptis_question_content_blocks;
CREATE POLICY "Authenticated users can read Aptis question content blocks" ON public.aptis_question_content_blocks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read Aptis question options" ON public.aptis_question_options;
CREATE POLICY "Authenticated users can read Aptis question options" ON public.aptis_question_options FOR SELECT TO authenticated USING (true);

-- Private tables with NO SELECT/WRITE policies for client roles (anon/authenticated):
-- - aptis_question_answers
-- - practice_response_evaluations
-- - aptis_import_runs

-- 6.2. User Practice Attempts Policies (Granular Operations)
DROP POLICY IF EXISTS "Users can read their own practice attempts" ON public.practice_attempts;
CREATE POLICY "Users can read their own practice attempts" ON public.practice_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own practice attempts" ON public.practice_attempts;
CREATE POLICY "Users can create their own practice attempts" ON public.practice_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 6.3. User Practice Responses Policies (Granular Operations for In-Progress Attempts)
DROP POLICY IF EXISTS "Users can read responses for their attempts" ON public.practice_responses;
CREATE POLICY "Users can read responses for their attempts" ON public.practice_responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.practice_attempts a WHERE a.id = practice_responses.attempt_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can create responses for in-progress attempts" ON public.practice_responses;
CREATE POLICY "Users can create responses for in-progress attempts" ON public.practice_responses
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.practice_attempts a WHERE a.id = practice_responses.attempt_id AND a.user_id = auth.uid() AND a.status = 'in_progress'));

DROP POLICY IF EXISTS "Users can update responses for in-progress attempts" ON public.practice_responses;
CREATE POLICY "Users can update responses for in-progress attempts" ON public.practice_responses
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.practice_attempts a WHERE a.id = practice_responses.attempt_id AND a.user_id = auth.uid() AND a.status = 'in_progress'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.practice_attempts a WHERE a.id = practice_responses.attempt_id AND a.user_id = auth.uid() AND a.status = 'in_progress'));

DROP POLICY IF EXISTS "Users can delete responses for in-progress attempts" ON public.practice_responses;
CREATE POLICY "Users can delete responses for in-progress attempts" ON public.practice_responses
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.practice_attempts a WHERE a.id = practice_responses.attempt_id AND a.user_id = auth.uid() AND a.status = 'in_progress'));

-- 6.4. User Bookmark Policies (Granular Operations)
DROP POLICY IF EXISTS "Users can read their bookmarks" ON public.question_bookmarks;
CREATE POLICY "Users can read their bookmarks" ON public.question_bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their bookmarks" ON public.question_bookmarks;
CREATE POLICY "Users can create their bookmarks" ON public.question_bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their bookmarks" ON public.question_bookmarks;
CREATE POLICY "Users can delete their bookmarks" ON public.question_bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
