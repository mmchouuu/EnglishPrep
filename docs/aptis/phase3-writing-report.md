# APTIS Phase 3D — Writing Initial Import Report

## Summary
- **Source File**: `docs/05-writing.md`
- **Total Logical Questions**: 521
- **Total Clubs / Groups**: 65
- **Total Instructions Content Blocks**: 47

## Breakdown by Part
| Part | Title | Task Type | Word Limits | Tone | Recipient Type | Question Count |
|---|---|---|---|---|---|---|
| Part 1 | Word-level writing | Short answer | 1–5 words | Neutral | None | 235 |
| Part 2 | Short text writing | Short text | 20–30 words | Neutral | None | 48 |
| Part 3 | Three written responses | Chat response | 30–40 words | Informal | Member | 144 |
| Part 4 | Formal & informal emails | Informal email & Formal email | 40–50 / 120–150 words | Informal / Formal | Friend / Manager | 94 |

## Source Key & Content Hash Conventions
- **Question Key Format**: `writing-<club-slug>-p<part>-q<NNN>`
- **Instructions Content Block Format**: `writing-<club-slug>-p4-instructions`
- **Canonical Hash**: Derived deterministically from `skill`, `part_number`, `question_type`, `content`, `metadata`, `ui_config`, and bound instructions `content_hash`es. Contains NO timestamps, UUIDs, run_ids, or absolute paths.

## Database Schema Alignment (Phase 0 Compliant)
- `aptis_groups`: `skill, group_type, group_key, name, description, display_order, metadata` (Unique constraint: `skill, group_type, group_key`).
- `aptis_questions`: `skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash` (Unique constraint: `skill, source_key`).
- `aptis_question_groups`: `question_id, group_id, display_order`.
- `aptis_content_blocks`: `skill, block_type, source_key, title, content, media_url, metadata, content_hash`.
- `aptis_question_content_blocks`: `question_id, content_block_id, content_role, display_order`.
- `aptis_question_answers`: `question_id, solution_data`.
- `aptis_import_runs`: `source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at`.

## Missing Data Tracking
- **Missing Model Answers**: 0
- **Missing Rubric**: Handled with `missing_rubric = true` in solution_data status.

## Incremental Zero-Write Strategy
- Implemented using PostgreSQL `ON CONFLICT ... DO UPDATE WHERE ... IS DISTINCT FROM ...`.
- Re-running the seed SQL on an unchanged database performs 0 actual row updates.
- Transactional integrity guaranteed with `BEGIN` and `COMMIT`.
