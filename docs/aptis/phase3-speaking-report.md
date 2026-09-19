# APTIS Phase 3C — Speaking Initial Import Report

## Summary
- **Source File**: `docs/04-speaking.md`
- **Total Logical Questions**: 695
- **Total Topics / Practice Sets**: 206
- **Total Image Content Blocks**: 147

## Breakdown by Part
| Part | Title | Structure Unit Count | Question Count | Response Type | Prep Time | Speak Time | Image Blocks |
|---|---|---|---|---|---|---|---|
| Part 1 | Personal Information | 24 Core Stories | 149 prompts | `speaking_recording` | 0s | 30s | 0 |
| Part 2 | Describe One Photo | 52 SETs | 156 prompts (52 × 3) | `photo_description` | 45s | 45s | 75 |
| Part 3 | Compare Two Photos | 72 SETs | 216 prompts (72 × 3) | `photo_comparison` | 45s | 45s | 72 |
| Part 4 | Abstract Topic | 6 Core Stories / 58 Modules | 174 logical tasks (58 × 3) | `speaking_recording` | 60s | 120s | 0 |

## Part 1 Core Story Prompt Counts
| Core Story Topic | Prompt Count |
|---|---|
| CORE STORY 1 – Weekend with Friends | 5 |
| CORE STORY 2 – My Student Life | 5 |
| CORE STORY 3 – My Family | 3 |
| CORE STORY 4 – Life in Ho Chi Minh City | 3 |
| CORE STORY 5 – Vietnam & Culture | 9 |
| CORE STORY 6 – Daily Life & Free Time | 2 |
| CORE STORY 7 – Friends, Going Out & Celebrations | 8 |
| CORE STORY 8 – Study, Work & Interviews | 7 |
| CORE STORY 9 – Family, Childhood & Memories | 7 |
| CORE STORY 10 – Home & Living Space | 5 |
| CORE STORY 11 – Hometown, Neighbourhood & Heritage | 14 |
| CORE STORY 12 – Travel, Transport & Special Places | 13 |
| CORE STORY 13 – Food & Healthy Eating | 3 |
| CORE STORY 14 – Sports, Exercise & Walking | 5 |
| CORE STORY 15 – Books, Libraries & Learning Resources | 12 |
| CORE STORY 16 – English & Communication | 14 |
| CORE STORY 17 – Television, Film & Music | 11 |
| CORE STORY 18 – Weather & Seasons | 3 |
| CORE STORY 19 – Childhood Games | 4 |
| CORE STORY 20 – Well-being, Stress & Noise | 3 |
| CORE STORY 21 – Photographs & Memories | 3 |
| CORE STORY 22 – Colours & Clothing | 3 |
| CORE STORY 23 – Everyday Services & Technology | 6 |
| CORE STORY 24 – Animals | 1 |

## Source Key & Content Hash Conventions
- **Question Key Format**: `speaking-p<part>-topic<NNN>-q<NNN>`
- **Group Key Format**: `speaking-p<part>-topic<NNN>`
- **Image Content Block Key Format**: `speaking-p<part>-topic<NNN>-image<N>`
- **Canonical Hash**: Derived deterministically from `skill`, `part_number`, `question_type`, `content`, `metadata`, `ui_config`, and bound image `content_hash`es. Contains NO timestamps, UUIDs, run_ids, or absolute paths.

## Database Schema Alignment (Phase 0 Compliant)
- `aptis_groups`: `skill, group_type, group_key, name, description, display_order, metadata` (Unique constraint: `skill, group_type, group_key`).
- `aptis_questions`: `skill, part_number, question_type, source_key, source_file, content, display_order, ui_config, metadata, content_hash` (Unique constraint: `skill, source_key`).
- `aptis_question_groups`: `question_id, group_id, display_order`.
- `aptis_content_blocks`: `skill, block_type, source_key, title, content, media_url, metadata, content_hash`.
- `aptis_question_content_blocks`: `question_id, content_block_id, content_role, display_order`.
- `aptis_question_answers`: `question_id, solution_data`.
- `aptis_import_runs`: `source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at`.

## Missing Data Tracking
- **Missing Images**: 0
- **Missing Sample Answers**: 40
- **Missing Rubric**: Handled with `missing_rubric = true` in solution_data status.

## Incremental Zero-Write Strategy
- Implemented using PostgreSQL `ON CONFLICT ... DO UPDATE WHERE ... IS DISTINCT FROM ...`.
- Re-running the seed SQL on an unchanged database performs 0 actual row updates.
- Transactional integrity guaranteed with `BEGIN` and `COMMIT`.
