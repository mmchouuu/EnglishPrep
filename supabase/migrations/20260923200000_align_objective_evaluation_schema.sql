-- ============================================================================
-- Migration: Reconcile Duplicate AI Evaluation Versions & Align Objective Evaluation Schema
-- File: supabase/migrations/20260923200000_align_objective_evaluation_schema.sql
-- Scope: Expand evaluator_type CHECK, Reconcile Duplicate Versions, Rebuild Supersedes Chain, Sync Legacy evaluation_status, Assert Non-duplication, and Add Composite UNIQUE Constraint
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXPAND EVALUATOR TYPE CHECK CONSTRAINT
-- ----------------------------------------------------------------------------
ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS chk_evaluator_type_values;

ALTER TABLE public.practice_response_evaluations
  ADD CONSTRAINT chk_evaluator_type_values 
  CHECK (evaluator_type IN ('objective', 'ai', 'human'));

-- ----------------------------------------------------------------------------
-- 2. RECONCILE DUPLICATE EVALUATION VERSIONS & REBUILD SUPERSEDES CHAIN
-- ----------------------------------------------------------------------------
WITH duplicate_groups AS (
  SELECT response_id, evaluator_type
  FROM public.practice_response_evaluations
  WHERE response_id IS NOT NULL
    AND evaluator_type IS NOT NULL
  GROUP BY response_id, evaluator_type
  HAVING COUNT(*) <> COUNT(DISTINCT version) OR COUNT(version) <> COUNT(*)
),
ranked AS (
  SELECT
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.response_id, e.evaluator_type
      ORDER BY e.created_at ASC, e.id ASC
    ) AS new_version,
    LAG(e.id) OVER (
      PARTITION BY e.response_id, e.evaluator_type
      ORDER BY e.created_at ASC, e.id ASC
    ) AS previous_evaluation_id
  FROM public.practice_response_evaluations e
  INNER JOIN duplicate_groups d
    ON d.response_id = e.response_id
   AND d.evaluator_type = e.evaluator_type
)
UPDATE public.practice_response_evaluations e
SET
  version = ranked.new_version,
  supersedes_evaluation_id = ranked.previous_evaluation_id
FROM ranked
WHERE e.id = ranked.id
  AND (e.version IS DISTINCT FROM ranked.new_version OR e.supersedes_evaluation_id IS DISTINCT FROM ranked.previous_evaluation_id);

-- ----------------------------------------------------------------------------
-- 3. RECONCILE LEGACY evaluation_status COLUMN & RE-APPLY CHECK CONSTRAINT
-- ----------------------------------------------------------------------------
UPDATE public.practice_response_evaluations
SET evaluation_status = CASE
  WHEN status IN ('completed', 'needs_review') THEN 'evaluated'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'pending'
END
WHERE evaluation_status IS DISTINCT FROM (
  CASE
    WHEN status IN ('completed', 'needs_review') THEN 'evaluated'
    WHEN status = 'failed' THEN 'failed'
    ELSE 'pending'
  END
);

ALTER TABLE public.practice_response_evaluations
  DROP CONSTRAINT IF EXISTS practice_response_evaluations_evaluation_status_check;

ALTER TABLE public.practice_response_evaluations
  ADD CONSTRAINT practice_response_evaluations_evaluation_status_check 
  CHECK (evaluation_status IN ('pending', 'evaluated', 'failed'));

-- ----------------------------------------------------------------------------
-- 4. ASSERT NO DUPLICATE COMPOSITE TUPLE BEFORE UNIQUE CONSTRAINT
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_dup_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT response_id, evaluator_type, version
    FROM public.practice_response_evaluations
    WHERE response_id IS NOT NULL
      AND evaluator_type IS NOT NULL
      AND version IS NOT NULL
    GROUP BY response_id, evaluator_type, version
    HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Duplicate evaluation version remains after reconciliation (% duplicate tuples found)', v_dup_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. CREATE COMPOSITE UNIQUE CONSTRAINT
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_practice_response_evaluations_resp_evaltype_ver'
      AND conrelid = 'public.practice_response_evaluations'::regclass
  ) THEN
    ALTER TABLE public.practice_response_evaluations
      ADD CONSTRAINT uq_practice_response_evaluations_resp_evaltype_ver
      UNIQUE (response_id, evaluator_type, version);
  END IF;
END $$;
