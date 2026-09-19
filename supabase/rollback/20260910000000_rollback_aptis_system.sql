-- ============================================================================
-- Down Migration (Rollback): Aptis Practice Application Database Foundation
-- File: supabase/migrations/20260910000000_rollback_aptis_system.sql
-- Created at: 2026-09-10
-- ============================================================================

-- 1. DROP TABLES IN SAFE REVERSE DEPENDENCY ORDER
-- (PostgreSQL automatically drops triggers, policies, and indexes associated with dropped tables)
DROP TABLE IF EXISTS public.question_bookmarks;
DROP TABLE IF EXISTS public.practice_response_evaluations;
DROP TABLE IF EXISTS public.practice_responses;
DROP TABLE IF EXISTS public.practice_attempts;
DROP TABLE IF EXISTS public.aptis_question_answers;
DROP TABLE IF EXISTS public.aptis_question_options;
DROP TABLE IF EXISTS public.aptis_question_content_blocks;
DROP TABLE IF EXISTS public.aptis_question_groups;
DROP TABLE IF EXISTS public.aptis_questions;
DROP TABLE IF EXISTS public.aptis_content_blocks;
DROP TABLE IF EXISTS public.aptis_groups;
DROP TABLE IF EXISTS public.aptis_import_runs;

-- 2. DROP TRIGGER FUNCTION
DROP FUNCTION IF EXISTS public.set_aptis_updated_at();

-- 3. DROP CUSTOM ENUM TYPES
DROP TYPE IF EXISTS public.aptis_question_status_enum;
DROP TYPE IF EXISTS public.aptis_skill_enum;
