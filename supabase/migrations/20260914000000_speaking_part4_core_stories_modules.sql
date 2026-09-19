-- ============================================================================
-- Migration: Aptis Speaking Part 4 Core Stories & Modules Hierarchy
-- File: supabase/migrations/20260914000000_speaking_part4_core_stories_modules.sql
-- Scope: 6 Core Stories -> 58 Modules -> 174 Logical Questions
-- ============================================================================

BEGIN;

-- 0. Update check constraint on public.aptis_groups to allow core_story and module
ALTER TABLE public.aptis_groups DROP CONSTRAINT IF EXISTS aptis_groups_group_type_check;
ALTER TABLE public.aptis_groups ADD CONSTRAINT aptis_groups_group_type_check
  CHECK (group_type IN ('club', 'topic', 'practice_set', 'core_story', 'module'));

-- 1. Insert/Upsert 6 Core Stories into aptis_groups
INSERT INTO public.aptis_groups (skill, group_type, group_key, name, description, display_order, metadata)
VALUES
  ('speaking'::public.aptis_skill_enum, 'core_story', 'speaking-p4-core1', 'CORE STORY 1 – STUDY PROJECT AND PRESENTATION', 'Last semester, I worked with three classmates on an English presentation about technology and study habits...', 1, '{"part_number": 4, "core_number": 1}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'core_story', 'speaking-p4-core2', 'CORE STORY 2 – TRAVEL AND EXPLORING', 'Last summer, I took a memorable trip with my close friends to an interesting destination...', 2, '{"part_number": 4, "core_number": 2}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'core_story', 'speaking-p4-core3', 'CORE STORY 3 – SOCIAL & RELATIONSHIPS', 'A few months ago, I was involved in a meaningful activity with my friends and community...', 3, '{"part_number": 4, "core_number": 3}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'core_story', 'speaking-p4-core4', 'CORE STORY 4 – PERSONAL CHOICES & HABITS', 'Recently, I faced a situation where I had to make an important personal decision and manage my time...', 4, '{"part_number": 4, "core_number": 4}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'core_story', 'speaking-p4-core5', 'CORE STORY 5 – SPECIAL EVENTS & CULTURAL ACTIVITIES', 'Earlier this year, I attended a special event and experienced cultural changes in daily life...', 5, '{"part_number": 4, "core_number": 5}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'core_story', 'speaking-p4-core6', 'CORE STORY 6 – DAILY LIFE & FREE TIME', 'In my spare time, I often engage in relaxing activities like reading, music festivals, or sports events...', 6, '{"part_number": 4, "core_number": 6}'::jsonb)
ON CONFLICT (skill, group_type, group_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata;

-- 2. Insert/Upsert 58 Modules into aptis_groups (group_type = 'module')
INSERT INTO public.aptis_groups (skill, group_type, group_key, name, description, display_order, metadata)
VALUES
  -- CORE STORY 1 (Modules 1-16)
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic001', 'MODULE A – DIFFICULT QUESTION', NULL, 1, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "A"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic002', 'MODULE B – ACHIEVEMENT', NULL, 2, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "B"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic003', 'MODULE C – BUSY TIME', NULL, 3, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "C"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic004', 'MODULE D – LEARNING A NEW SKILL', NULL, 4, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "D"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic005', 'MODULE E – PLANNING', NULL, 5, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "E"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic006', 'MODULE F – TEAMWORK', NULL, 6, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "F"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic007', 'MODULE G – GREAT EFFORT', NULL, 7, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "G"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic008', 'MODULE H – ASKING A GOOD QUESTION', NULL, 8, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "H"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic009', 'MODULE I – ENGLISH COURSE', NULL, 9, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "I"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic010', 'MODULE J – OVERCOMING A CHALLENGE', NULL, 10, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "J"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic011', 'MODULE K – TECHNOLOGY HELPED ME', NULL, 11, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "K"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic012', 'MODULE L – MAJOR RESPONSIBILITY', NULL, 12, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "L"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic013', 'MODULE M – GIVING A PRESENTATION', NULL, 13, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "M"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic014', 'MODULE N – TRYING SOMETHING NEW', NULL, 14, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "N"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic015', 'MODULE O – CHANGING SCHOOLS', NULL, 15, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "O"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic016', 'MODULE P – INTERESTING INFORMATION', NULL, 16, '{"part_number": 4, "parent_core_key": "speaking-p4-core1", "module_letter": "P"}'::jsonb),

  -- CORE STORY 2 (Modules 17-27)
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic017', 'MODULE A – LONG TRIP', NULL, 17, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "A"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic018', 'MODULE B – EXPLORING A FOREST', NULL, 18, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "B"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic019', 'MODULE C – VISITING A TALL BUILDING', NULL, 19, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "C"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic020', 'MODULE D – A HOLIDAY OR VACATION', NULL, 20, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "D"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic021', 'MODULE E – BAD WEATHER', NULL, 21, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "E"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic022', 'MODULE F – EXTREME SPORT', NULL, 22, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "F"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic023', 'MODULE G – VISITING A NEW CITY', NULL, 23, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "G"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic024', 'MODULE H – HISTORIC BUILDING', NULL, 24, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "H"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic025', 'MODULE I – A MEMORABLE PLACE OR TRIP', NULL, 25, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "I"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic026', 'MODULE J – GETTING LOST', NULL, 26, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "J"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic027', 'MODULE K – AMUSEMENT PARK', NULL, 27, '{"part_number": 4, "parent_core_key": "speaking-p4-core2", "module_letter": "K"}'::jsonb),

  -- CORE STORY 3 (Modules 28-40)
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic028', 'MODULE A – VISITING A FRIEND', NULL, 28, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "A"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic029', 'MODULE B – HELPING SOMEONE', NULL, 29, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "B"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic030', 'MODULE C – ACTIVITY FOR CHILDREN', NULL, 30, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "C"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic031', 'MODULE D – LAUGHING WITH A FRIEND', NULL, 31, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "D"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic032', 'MODULE E – MEETING A NEW FRIEND', NULL, 32, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "E"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic033', 'MODULE F – RECEIVING GOOD NEWS', NULL, 33, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "F"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic034', 'MODULE G – DIFFERENT GENERATIONS', NULL, 34, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "G"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic035', 'MODULE H – A SPECIAL GIFT', NULL, 35, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "H"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic036', 'MODULE I – RECEIVING HELP', NULL, 36, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "I"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic037', 'MODULE J – MEETING A FOREIGNER', NULL, 37, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "J"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic038', 'MODULE K – SHARING SOMETHING', NULL, 38, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "K"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic039', 'MODULE L – RECEIVING A COMPLIMENT', NULL, 39, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "L"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic040', 'MODULE M – VOLUNTEER OR COMMUNITY ACTIVITY', NULL, 40, '{"part_number": 4, "parent_core_key": "speaking-p4-core3", "module_letter": "M"}'::jsonb),

  -- CORE STORY 4 (Modules 41-49)
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic041', 'MODULE A – WANTING SOMETHING I COULD NOT GET', NULL, 41, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "A"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic042', 'MODULE B – SAVING MONEY', NULL, 42, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "B"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic043', 'MODULE C – SOMETHING I REALLY WANTED TO BUY', NULL, 43, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "C"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic044', 'MODULE D – MAKING A CHOICE', NULL, 44, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "D"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic045', 'MODULE E – BEING IN A HURRY', NULL, 45, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "E"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic046', 'MODULE F – DOING SOMETHING I DISLIKED', NULL, 46, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "F"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic047', 'MODULE G – SLEEPING HABITS', NULL, 47, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "G"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic048', 'MODULE H – BREAKING A RULE', NULL, 48, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "H"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic049', 'MODULE I – BEING ASKED TO STOP', NULL, 49, '{"part_number": 4, "parent_core_key": "speaking-p4-core4", "module_letter": "I"}'::jsonb),

  -- CORE STORY 5 (Modules 50-53)
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic050', 'MODULE A – FAVOURITE OR FORMAL CLOTHES', NULL, 50, '{"part_number": 4, "parent_core_key": "speaking-p4-core5", "module_letter": "A"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic051', 'MODULE B – MEETING A RUDE PERSON', NULL, 51, '{"part_number": 4, "parent_core_key": "speaking-p4-core5", "module_letter": "B"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic052', 'MODULE C – CHANGING A DAILY ROUTINE', NULL, 52, '{"part_number": 4, "parent_core_key": "speaking-p4-core5", "module_letter": "C"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic053', 'MODULE D – CHANGING JOBS', NULL, 53, '{"part_number": 4, "parent_core_key": "speaking-p4-core5", "module_letter": "D"}'::jsonb),

  -- CORE STORY 6 (Modules 54-58)
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic054', 'MODULE A – WAITING FOR SOMETHING IMPORTANT', NULL, 54, '{"part_number": 4, "parent_core_key": "speaking-p4-core6", "module_letter": "A"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic055', 'MODULE B – SPORTS EVENT', NULL, 55, '{"part_number": 4, "parent_core_key": "speaking-p4-core6", "module_letter": "B"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic056', 'MODULE C – MUSIC FESTIVAL', NULL, 56, '{"part_number": 4, "parent_core_key": "speaking-p4-core6", "module_letter": "C"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic057', 'MODULE D – READING A GOOD BOOK', NULL, 57, '{"part_number": 4, "parent_core_key": "speaking-p4-core6", "module_letter": "D"}'::jsonb),
  ('speaking'::public.aptis_skill_enum, 'module', 'speaking-p4-topic058', 'MODULE E – A WORK OF ART', NULL, 58, '{"part_number": 4, "parent_core_key": "speaking-p4-core6", "module_letter": "E"}'::jsonb)
ON CONFLICT (skill, group_type, group_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata;

COMMIT;
