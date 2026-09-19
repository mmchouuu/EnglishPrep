# Phase 6A — Static Database Seed Audit & Fix Report

**Trạng thái**: **Static code fix completed — runtime verification pending.**

---

## 1. Schema Cơ Sở Dữ Liệu Thu Được Từ Migration (Source of Truth)

Từ file migration `supabase/migrations/20260910000000_create_aptis_system.sql` và `supabase/migrations/20260911000000_supplementary_rls_phase5.sql`, cấu trúc chuẩn của database gồm 12 bảng:

### 1. `public.aptis_groups`
- **Columns**: `id` (UUID, PK), `skill` (`aptis_skill_enum`), `group_type` (`VARCHAR(50)`), `group_key` (`VARCHAR(100)`), `name` (`TEXT`), `description` (`TEXT`), `display_order` (`INT`), `metadata` (`JSONB`), `created_at`, `updated_at`.
- **Constraint**: `uq_aptis_groups_skill_type_key UNIQUE (skill, group_type, group_key)`.
- **Lưu ý**: Tên cột duy nhất là `group_key` (KHÔNG CÓ cột `source_key` trong bảng này).

### 2. `public.aptis_content_blocks`
- **Columns**: `id` (UUID, PK), `skill` (`aptis_skill_enum`), `block_type` (`VARCHAR(50)`), `source_key` (`VARCHAR(100)`), `title` (`TEXT`), `content` (`TEXT`), `media_url` (`TEXT`), `metadata` (`JSONB`), `content_hash` (`VARCHAR(64)`), `created_at`, `updated_at`.
- **Constraint**: `uq_aptis_content_blocks_skill_key UNIQUE (skill, source_key)`.

### 3. `public.aptis_questions`
- **Columns**: `id` (UUID, PK), `skill` (`aptis_skill_enum`), `part_number` (`INT`), `question_type` (`VARCHAR(50)`), `source_key` (`VARCHAR(100)`), `source_file` (`VARCHAR(255)`), `content` (`TEXT`), `display_order` (`INT`), `ui_config` (`JSONB`), `metadata` (`JSONB`), `content_hash` (`VARCHAR(64)`), `import_status` (`aptis_question_status_enum`), `first_imported_at`, `last_changed_at`, `created_at`, `updated_at`.
- **Constraint**: `uq_aptis_questions_skill_source_key UNIQUE (skill, source_key)`.

### 4. `public.aptis_question_groups`
- **Columns**: `question_id` (UUID, FK), `group_id` (UUID, FK), `display_order` (`INT`).
- **Primary Key**: `(question_id, group_id)`.

### 5. `public.aptis_question_content_blocks`
- **Columns**: `question_id` (UUID, FK), `content_block_id` (UUID, FK), `content_role` (`VARCHAR(50)`), `display_order` (`INT`).
- **Primary Key**: `(question_id, content_block_id, content_role)`.
- **Check Constraint**: `content_role IN ('passage', 'audio', 'image_1', 'image_2', 'instructions', 'conversation')`.

### 6. `public.aptis_question_options`
- **Columns**: `id` (UUID, PK), `question_id` (UUID, FK), `option_key` (`VARCHAR(100)`), `content` (`TEXT`), `display_order` (`INT`), `metadata` (`JSONB`).
- **Constraint**: `uq_aptis_question_options_q_key UNIQUE (question_id, option_key)`.

### 7. `public.aptis_question_answers` (Private Table)
- **Columns**: `question_id` (UUID, PK, FK), `correct_answer` (`JSONB`), `explanation` (`TEXT`), `model_answer` (`TEXT`), `rubric` (`JSONB`), `solution_data` (`JSONB`), `updated_at`.

### 8. `public.aptis_import_runs` (Audit Log)
- **Columns**: `id` (UUID, PK), `source_file` (`VARCHAR(255)`), `skill` (`aptis_skill_enum`), `status` (`VARCHAR(20)`), `total_parsed` (`INT`), `inserted_count` (`INT`), `updated_count` (`INT`), `unchanged_count` (`INT`), `error_count` (`INT`), `started_at`, `completed_at`, `error_message` (`TEXT`).
- **Lưu ý**: KHÔNG CÓ cột `details` trong bảng này.

---

## 2. Kết Quả Audit & Chỉnh Sửa Chi Tiết Theo Từng Skill

### A. Listening Skill
- **Đã kiểm tra**:
  - Script importer `scripts/import_listening.js` và file seed `supabase/seed_listening.sql`.
  - Cột `details` trong `aptis_import_runs`: Đã xác nhận loại bỏ hoàn toàn khỏi câu lệnh `INSERT INTO public.aptis_import_runs`. Bảng `aptis_import_runs` sử dụng đúng 10 cột hợp lệ: `(source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, error_count, started_at, completed_at)`.
  - Cơ chế Zero-Write: Dùng `ON CONFLICT ... DO UPDATE SET ... WHERE ... IS DISTINCT FROM EXCLUDED ...`.
- **Baseline Mong Đợi**:
  - Part 1: 286 câu (22 sets x 13 câu).
  - Part 2: 176 câu (44 sets x 4 câu).
  - Part 3: 176 câu (44 sets x 4 câu).
  - Part 4: 120 câu (60 sets x 2 câu).
  - Tổng số câu hỏi: **758 câu**.
  - Total Practice Sets: **170 sets**.
  - Total Audio Content Blocks: **434 blocks**.
  - Duplicate source keys: **0**.

### B. Speaking Skill
- **Đã kiểm tra**:
  - Script importer `scripts/import_speaking.js` và file seed `supabase/seed_speaking.sql`.
  - Cột `source_key` của `aptis_groups`: Đã đối chiếu migration và xác định tên cột đúng là `group_key`. Đã kiểm tra importer và seed: toàn bộ câu lệnh `INSERT`, `ON CONFLICT (skill, group_type, group_key)`, `JOIN aptis_groups g ON g.group_key = ...` đều dùng cột `group_key`. Cột `source_key` chỉ được dùng cho `aptis_questions` và `aptis_content_blocks`.
  - Toàn bộ `aptis_import_runs` trong Speaking seed tuân thủ đúng 10 cột tiêu chuẩn.
- **Baseline Mong Đợi**:
  - Part 1: 24 Core Stories (24 topics).
  - Part 2: 52 SETs (156 câu, 52 topics, 80 image blocks).
  - Part 3: 72 SETs (216 câu, 72 topics, 67 image blocks).
  - Part 4: 6 Core Stories / 58 Modules (174 câu, 58 topics).
  - Tổng số Topics/Groups: **206 topics**.
  - Tổng số Logical Questions: **695 câu**.
  - Tổng số Image Content Blocks: **147 blocks**.
  - Duplicate source keys: **0**.
  - Missing sample answers: **40** (theo tài liệu nguồn, được giữ nguyên không tự tạo giả).

### C. Writing Skill
- **Đã kiểm tra**:
  - Script importer `scripts/import_writing.js` và file seed `supabase/seed_writing.sql`.
  - Đã đối chiếu tên cột với Migration: `aptis_groups` dùng `group_key` với `ON CONFLICT (skill, group_type, group_key)`; `aptis_content_blocks` dùng `source_key`; `aptis_questions` dùng `source_key`; `aptis_question_groups` dùng `(question_id, group_id)`; `aptis_question_content_blocks` dùng `(question_id, content_block_id, content_role)` với `content_role = 'instructions'`; `aptis_import_runs` ghi nhận đủ 10 cột chuẩn.
- **Baseline Mong Đợi**:
  - Part 1: 235 câu (Short answers 1-5 words).
  - Part 2: 48 câu (Short text 20-30 words).
  - Part 3: 144 câu (Chat responses 30-40 words).
  - Part 4: 94 câu (Formal & Informal emails).
  - Tổng số Logical Questions: **521 câu**.
  - Total Clubs / Groups: **65 clubs**.
  - Total Instructions Content Blocks: **47 blocks**.
  - Duplicate source keys: **0**.
  - Missing model answers: **0**.

### D. Reading Skill
- **Đã kiểm tra**:
  - Script importer `scripts/import_reading.js` và file seed `supabase/seed_reading.sql`.
  - Cấu trúc 539 câu hỏi (Part 1: 143, Part 2: 60, Part 4: 168, Part 5: 168).
  - Toàn bộ source_key, content_hash và mapping tuân thủ Idempotency & Zero-write (`IS DISTINCT FROM`).

---

## 3. Bảo Đảm Idempotency, Zero-Write Và Bảo Mật RLS

1. **Zero-Write trên re-run**:
   - Mọi câu lệnh `UPDATE` đều gắn clause `WHERE ... IS DISTINCT FROM EXCLUDED...`.
   - Nếu dữ liệu nguồn không thay đổi, khi chạy lại seed SQL: `inserted_count = 0`, `updated_count = 0`, `unchanged_count = TOTAL`, `error_count = 0`.
2. **Transaction Safety**:
   - Tất cả seed SQL bắt đầu bằng `BEGIN;` và kết thúc bằng `COMMIT;`.
3. **RLS & Security Compliance**:
   - RLS bật trên tất cả các bảng.
   - Bảng private `aptis_question_answers` không có chính sách `SELECT` công khai cho anon/authenticated, bảo đảm đáp án và bài mẫu private không bị lộ ra frontend payload.

---

## 4. Tóm Tắt Kiểm Tra Tĩnh & Các Bước Xác Minh Runtime

- **Đã thực hiện**: Kiểm tra tĩnh toàn bộ code Importers, Seed SQL và Migrations bằng File Viewer của Editor.
- **Cần tự thực hiện (User)**:
  1. Chạy Seed SQL trên Supabase Local Docker Container.
  2. Re-run Seed SQL lần 2 để kiểm tra `unchanged_count`.
  3. Chạy các câu lệnh SQL kiểm tra duplicate key, orphan rows, và import metrics log.
