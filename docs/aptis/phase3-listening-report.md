# Phase 3B — Listening Inline Transcripts Import Report

## 1. Thông Tin Nguồn & Phân Vùng
- **File nguồn thực tế**: `docs/03-listening-inline-transcripts.md`
- **Skill**: `listening`
- **Thời gian xử lý**: `2026-09-17T08:29:33.049Z`
- **Cấu trúc transcript**: Inline `<details class="audio-transcript">` lấy từ Word Comments.

---

## 2. Thống Kê Dữ Liệu Từng Part

| Part | Tên Dạng Bài | Số lượng Question | Số Practice Set | Số Audio Block | Question Type | Transcript Status |
|------|--------------|-------------------|-----------------|----------------|---------------|-------------------|
| **Part 1** | Information Recognition | 286 câu | 22 sets (13 câu/set) | 286 audio blocks | `multiple_choice` | `source_word_comment` |
| **Part 2** | Information Matching | 176 câu | 44 sets (4 câu/set) | 44 audio blocks | `listening_matching` | `source_word_comments` |
| **Part 3** | Speaker / Opinion Matching | 176 câu | 44 sets (4 câu/set) | 44 audio blocks | `listening_matching` | 43 `source_word_comment`, 1 `missing_source_comment` |
| **Part 4** | Longer Monologues | 120 câu | 60 sets (2 câu/set) | 60 audio blocks | `listening_multiple_choice` | `source_word_comment` |
| **TỔNG** | **Toàn bộ Listening** | **758 câu** | **170 sets** | **434 blocks** | - | **433 có script, 1 thiếu script** |

- **Tổng số Word Comments**: 565 comments.
- **Part 1 Topic Groups**: 8 topic groups (`time_date_duration`, `numbers_money_codes`, `places_directions`, `travel_transport_mode`, `people_relationships`, `reasons_opinions_purpose`, `objects_descriptions`, `activities_events_details`).
- **Missing Transcript Audio Block**: `listening-p3-set004-audio` (Topic: Information and technology).

---

## 3. Thống Kê Manifest

| Chỉ Số Manifest | Giá Trị | Mô Tả |
|------------------|---------|-------|
| **active_count** | 758 | Số question record khớp 100% kết quả parse |
| **audio_blocks_count** | 434 | Số audio content block |
| **added_count** | 0 | Số question key mới |
| **retained_count** | 758 | Số question key giữ nguyên |
| **removed_stale_count** | 0 | Số key cũ đã dọn dẹp |
| **duplicate_count** | 0 | Key trùng lặp (yêu cầu = 0) |

---

## 4. Cơ Chế Zero-Write Incremental

Khi thực thi seed SQL trên cơ sở dữ liệu:
1. **Lần đầu import**: Upsert đủ 758 câu, 434 audio blocks, 178 groups.
2. **Lần chạy lại không đổi**: So sánh `content_hash IS DISTINCT FROM EXCLUDED.content_hash`.
   - Kết quả: `inserted_count = 0`, `updated_count = 0`, `unchanged_count = 758`, `error_count = 0`.

---

## 5. Bảo Vệ Đáp Án & Transcript

- Frontend public payload chỉ query qua public service API (không query `aptis_question_answers`).
- Solutions & Transcripts được lưu trong `aptis_question_answers.solution_data` và `aptis_content_blocks.metadata`.

---

## 6. Trạng Thái Hoàn Thành

Static Listening inline transcript and database integration completed — runtime verification pending.
