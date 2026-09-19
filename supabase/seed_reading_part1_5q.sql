-- ============================================================================
-- Seed: Reading Part 1 (First 5 Questions)
-- Generated at: 2026-09-10T17:16:39.659Z
-- Source: docs/02-reading.md
-- ============================================================================

BEGIN;

DO $aptis_import$
DECLARE
  v_run_id UUID := '544c5fbc-30cc-4287-8689-a29b5714c1af';
  v_start_time TIMESTAMPTZ := '2026-09-10T17:16:39.659Z';
  v_group_id UUID;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_unchanged INT := 0;
  v_q_id UUID;
  v_old_hash VARCHAR(64);
  v_old_status public.aptis_question_status_enum;
BEGIN
  -- 1. Record Audit Log Entry (Status: running)
  INSERT INTO public.aptis_import_runs (id, source_file, skill, status, total_parsed, started_at)
  VALUES (v_run_id, 'docs/02-reading.md', 'reading', 'running', 5, v_start_time);

  -- 2. Ensure Practice Set Group Exists (Zero-write if unchanged)
  INSERT INTO public.aptis_groups (skill, group_type, group_key, name, display_order)
  VALUES ('reading'::public.aptis_skill_enum, 'practice_set', 'reading-p1-set001', 'Reading Part 1 Set 001', 1)
  ON CONFLICT (skill, group_type, group_key) DO NOTHING;

  SELECT id INTO v_group_id
  FROM public.aptis_groups
  WHERE skill = 'reading'::public.aptis_skill_enum
    AND group_type = 'practice_set'
    AND group_key = 'reading-p1-set001';

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve group_id for practice_set reading-p1-set001';
  END IF;

  ----------------------------------------------------------------------------
  -- Question 1: reading-p1-set001-q001
  ----------------------------------------------------------------------------
  v_q_id := NULL;
  v_old_hash := NULL;
  SELECT id, content_hash, import_status INTO v_q_id, v_old_hash, v_old_status
  FROM public.aptis_questions
  WHERE skill = 'reading' AND source_key = 'reading-p1-set001-q001';

  IF v_q_id IS NULL THEN
    -- New Question Insert
    INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, metadata, ui_config, content_hash, import_status, first_imported_at, last_changed_at)
    VALUES ('reading'::public.aptis_skill_enum, 1, 'multiple_choice', 'reading-p1-set001-q001', 'docs/02-reading.md', 'Take the bus to the main ______.', 1, '{}'::jsonb, '{}'::jsonb, 'adb9125b9133db00623749c65011483608ad2d785015647e99b032c25337db99', 'imported'::public.aptis_question_status_enum, NOW(), NOW())
    RETURNING id INTO v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'station', 1),
      (v_q_id, 'B', 'run', 2),
      (v_q_id, 'C', 'walk', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"A"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 1)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_inserted := v_inserted + 1;

  ELSIF v_old_hash <> 'adb9125b9133db00623749c65011483608ad2d785015647e99b032c25337db99' THEN
    -- Changed Question Update (Complete field refresh)
    UPDATE public.aptis_questions
    SET part_number = 1,
        question_type = 'multiple_choice',
        source_file = 'docs/02-reading.md',
        content = 'Take the bus to the main ______.',
        display_order = 1,
        metadata = '{}'::jsonb,
        ui_config = '{}'::jsonb,
        content_hash = 'adb9125b9133db00623749c65011483608ad2d785015647e99b032c25337db99',
        import_status = 'updated'::public.aptis_question_status_enum,
        last_changed_at = NOW()
    WHERE id = v_q_id;

    -- Remove stale options before inserting fresh option set
    DELETE FROM public.aptis_question_options WHERE question_id = v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'station', 1),
      (v_q_id, 'B', 'run', 2),
      (v_q_id, 'C', 'walk', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"A"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 1)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_updated := v_updated + 1;

  ELSE
    -- Unchanged Question (Zero-write on question/options/answer)
    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 1)
    ON CONFLICT (question_id, group_id) DO NOTHING;

    v_unchanged := v_unchanged + 1;
  END IF;

  ----------------------------------------------------------------------------
  -- Question 2: reading-p1-set001-q002
  ----------------------------------------------------------------------------
  v_q_id := NULL;
  v_old_hash := NULL;
  SELECT id, content_hash, import_status INTO v_q_id, v_old_hash, v_old_status
  FROM public.aptis_questions
  WHERE skill = 'reading' AND source_key = 'reading-p1-set001-q002';

  IF v_q_id IS NULL THEN
    -- New Question Insert
    INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, metadata, ui_config, content_hash, import_status, first_imported_at, last_changed_at)
    VALUES ('reading'::public.aptis_skill_enum, 1, 'multiple_choice', 'reading-p1-set001-q002', 'docs/02-reading.md', 'I saw some shoes in the ______ of one store.', 2, '{}'::jsonb, '{}'::jsonb, '45db9243342f0a52753b0b5109cd82fd7139c95e828c8603c84ec6deac92ef74', 'imported'::public.aptis_question_status_enum, NOW(), NOW())
    RETURNING id INTO v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'market', 1),
      (v_q_id, 'B', 'window', 2),
      (v_q_id, 'C', 'shoe', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"B"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 2)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_inserted := v_inserted + 1;

  ELSIF v_old_hash <> '45db9243342f0a52753b0b5109cd82fd7139c95e828c8603c84ec6deac92ef74' THEN
    -- Changed Question Update (Complete field refresh)
    UPDATE public.aptis_questions
    SET part_number = 1,
        question_type = 'multiple_choice',
        source_file = 'docs/02-reading.md',
        content = 'I saw some shoes in the ______ of one store.',
        display_order = 2,
        metadata = '{}'::jsonb,
        ui_config = '{}'::jsonb,
        content_hash = '45db9243342f0a52753b0b5109cd82fd7139c95e828c8603c84ec6deac92ef74',
        import_status = 'updated'::public.aptis_question_status_enum,
        last_changed_at = NOW()
    WHERE id = v_q_id;

    -- Remove stale options before inserting fresh option set
    DELETE FROM public.aptis_question_options WHERE question_id = v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'market', 1),
      (v_q_id, 'B', 'window', 2),
      (v_q_id, 'C', 'shoe', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"B"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 2)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_updated := v_updated + 1;

  ELSE
    -- Unchanged Question (Zero-write on question/options/answer)
    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 2)
    ON CONFLICT (question_id, group_id) DO NOTHING;

    v_unchanged := v_unchanged + 1;
  END IF;

  ----------------------------------------------------------------------------
  -- Question 3: reading-p1-set001-q003
  ----------------------------------------------------------------------------
  v_q_id := NULL;
  v_old_hash := NULL;
  SELECT id, content_hash, import_status INTO v_q_id, v_old_hash, v_old_status
  FROM public.aptis_questions
  WHERE skill = 'reading' AND source_key = 'reading-p1-set001-q003';

  IF v_q_id IS NULL THEN
    -- New Question Insert
    INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, metadata, ui_config, content_hash, import_status, first_imported_at, last_changed_at)
    VALUES ('reading'::public.aptis_skill_enum, 1, 'multiple_choice', 'reading-p1-set001-q003', 'docs/02-reading.md', 'I get up early in the ____ and I go running.', 3, '{}'::jsonb, '{}'::jsonb, 'af8bf4aef797a134fcdcd944e63aa06ec612f1e310f30d104f4da189a5262372', 'imported'::public.aptis_question_status_enum, NOW(), NOW())
    RETURNING id INTO v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'morning', 1),
      (v_q_id, 'B', 'friends', 2),
      (v_q_id, 'C', 'leave', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"A"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 3)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_inserted := v_inserted + 1;

  ELSIF v_old_hash <> 'af8bf4aef797a134fcdcd944e63aa06ec612f1e310f30d104f4da189a5262372' THEN
    -- Changed Question Update (Complete field refresh)
    UPDATE public.aptis_questions
    SET part_number = 1,
        question_type = 'multiple_choice',
        source_file = 'docs/02-reading.md',
        content = 'I get up early in the ____ and I go running.',
        display_order = 3,
        metadata = '{}'::jsonb,
        ui_config = '{}'::jsonb,
        content_hash = 'af8bf4aef797a134fcdcd944e63aa06ec612f1e310f30d104f4da189a5262372',
        import_status = 'updated'::public.aptis_question_status_enum,
        last_changed_at = NOW()
    WHERE id = v_q_id;

    -- Remove stale options before inserting fresh option set
    DELETE FROM public.aptis_question_options WHERE question_id = v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'morning', 1),
      (v_q_id, 'B', 'friends', 2),
      (v_q_id, 'C', 'leave', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"A"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 3)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_updated := v_updated + 1;

  ELSE
    -- Unchanged Question (Zero-write on question/options/answer)
    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 3)
    ON CONFLICT (question_id, group_id) DO NOTHING;

    v_unchanged := v_unchanged + 1;
  END IF;

  ----------------------------------------------------------------------------
  -- Question 4: reading-p1-set001-q004
  ----------------------------------------------------------------------------
  v_q_id := NULL;
  v_old_hash := NULL;
  SELECT id, content_hash, import_status INTO v_q_id, v_old_hash, v_old_status
  FROM public.aptis_questions
  WHERE skill = 'reading' AND source_key = 'reading-p1-set001-q004';

  IF v_q_id IS NULL THEN
    -- New Question Insert
    INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, metadata, ui_config, content_hash, import_status, first_imported_at, last_changed_at)
    VALUES ('reading'::public.aptis_skill_enum, 1, 'multiple_choice', 'reading-p1-set001-q004', 'docs/02-reading.md', 'Everyone is ______.', 4, '{}'::jsonb, '{}'::jsonb, 'a3ade79084a973bd7847e8ef54dcf86c478ecbfdc6093d559fb9785856ed25d3', 'imported'::public.aptis_question_status_enum, NOW(), NOW())
    RETURNING id INTO v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'friendly', 1),
      (v_q_id, 'B', 'melty', 2),
      (v_q_id, 'C', 'noisy', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"A"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 4)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_inserted := v_inserted + 1;

  ELSIF v_old_hash <> 'a3ade79084a973bd7847e8ef54dcf86c478ecbfdc6093d559fb9785856ed25d3' THEN
    -- Changed Question Update (Complete field refresh)
    UPDATE public.aptis_questions
    SET part_number = 1,
        question_type = 'multiple_choice',
        source_file = 'docs/02-reading.md',
        content = 'Everyone is ______.',
        display_order = 4,
        metadata = '{}'::jsonb,
        ui_config = '{}'::jsonb,
        content_hash = 'a3ade79084a973bd7847e8ef54dcf86c478ecbfdc6093d559fb9785856ed25d3',
        import_status = 'updated'::public.aptis_question_status_enum,
        last_changed_at = NOW()
    WHERE id = v_q_id;

    -- Remove stale options before inserting fresh option set
    DELETE FROM public.aptis_question_options WHERE question_id = v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'friendly', 1),
      (v_q_id, 'B', 'melty', 2),
      (v_q_id, 'C', 'noisy', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"A"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 4)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_updated := v_updated + 1;

  ELSE
    -- Unchanged Question (Zero-write on question/options/answer)
    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 4)
    ON CONFLICT (question_id, group_id) DO NOTHING;

    v_unchanged := v_unchanged + 1;
  END IF;

  ----------------------------------------------------------------------------
  -- Question 5: reading-p1-set001-q005
  ----------------------------------------------------------------------------
  v_q_id := NULL;
  v_old_hash := NULL;
  SELECT id, content_hash, import_status INTO v_q_id, v_old_hash, v_old_status
  FROM public.aptis_questions
  WHERE skill = 'reading' AND source_key = 'reading-p1-set001-q005';

  IF v_q_id IS NULL THEN
    -- New Question Insert
    INSERT INTO public.aptis_questions (skill, part_number, question_type, source_key, source_file, content, display_order, metadata, ui_config, content_hash, import_status, first_imported_at, last_changed_at)
    VALUES ('reading'::public.aptis_skill_enum, 1, 'multiple_choice', 'reading-p1-set001-q005', 'docs/02-reading.md', 'I start ______ in the morning.', 5, '{}'::jsonb, '{}'::jsonb, '8fa3200f925c50bd80ea45a56b51e9ea660d384652a78a76a0bf7ecfa8f0246d', 'imported'::public.aptis_question_status_enum, NOW(), NOW())
    RETURNING id INTO v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'sleep', 1),
      (v_q_id, 'B', 'early', 2),
      (v_q_id, 'C', 'angry', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"B"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 5)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_inserted := v_inserted + 1;

  ELSIF v_old_hash <> '8fa3200f925c50bd80ea45a56b51e9ea660d384652a78a76a0bf7ecfa8f0246d' THEN
    -- Changed Question Update (Complete field refresh)
    UPDATE public.aptis_questions
    SET part_number = 1,
        question_type = 'multiple_choice',
        source_file = 'docs/02-reading.md',
        content = 'I start ______ in the morning.',
        display_order = 5,
        metadata = '{}'::jsonb,
        ui_config = '{}'::jsonb,
        content_hash = '8fa3200f925c50bd80ea45a56b51e9ea660d384652a78a76a0bf7ecfa8f0246d',
        import_status = 'updated'::public.aptis_question_status_enum,
        last_changed_at = NOW()
    WHERE id = v_q_id;

    -- Remove stale options before inserting fresh option set
    DELETE FROM public.aptis_question_options WHERE question_id = v_q_id;

    INSERT INTO public.aptis_question_options (question_id, option_key, content, display_order)
    VALUES
      (v_q_id, 'A', 'sleep', 1),
      (v_q_id, 'B', 'early', 2),
      (v_q_id, 'C', 'angry', 3)
    ON CONFLICT (question_id, option_key) DO UPDATE SET content = EXCLUDED.content, display_order = EXCLUDED.display_order;

    INSERT INTO public.aptis_question_answers (question_id, correct_answer)
    VALUES (v_q_id, '{"correct_option":"B"}'::jsonb)
    ON CONFLICT (question_id) DO UPDATE SET correct_answer = EXCLUDED.correct_answer;

    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 5)
    ON CONFLICT (question_id, group_id) DO UPDATE SET display_order = EXCLUDED.display_order;

    v_updated := v_updated + 1;

  ELSE
    -- Unchanged Question (Zero-write on question/options/answer)
    INSERT INTO public.aptis_question_groups (question_id, group_id, display_order)
    VALUES (v_q_id, v_group_id, 5)
    ON CONFLICT (question_id, group_id) DO NOTHING;

    v_unchanged := v_unchanged + 1;
  END IF;

  -- Update audit log on successful transaction completion
  UPDATE public.aptis_import_runs
  SET status = 'completed',
      inserted_count = v_inserted,
      updated_count = v_updated,
      unchanged_count = v_unchanged,
      error_count = 0,
      completed_at = NOW()
  WHERE id = v_run_id;

EXCEPTION WHEN OTHERS THEN
  -- Note: The transaction block is atomic. Any unhandled exception triggers a RAISE
  -- which rolls back all data modifications made within this transaction, including aptis_import_runs.
  RAISE;
END $aptis_import$;

COMMIT;
