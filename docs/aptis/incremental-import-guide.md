# Hướng Dẫn Incremental Import APTIS (Phase 4)

Tài liệu này hướng dẫn quy trình thêm mới hoặc cập nhật một câu hỏi/bộ câu hỏi lẻ cho 4 skill APTIS (**Reading, Listening, Speaking, Writing**) mà không cần đọc lại toàn bộ file skill nguồn và không đè/xóa các record không đổi.

---

## 1. Cấu Trúc File Update

Mọi file bổ sung/chỉnh sửa được đặt tại thư mục tương ứng:

```text
docs/aptis/updates/
├── reading/
├── listening/
├── speaking/
└── writing/
```

Ví dụ tên file update: `docs/aptis/updates/reading/20260911-reading-p1-additions.md`

### Bắt buộc Front Matter
Mỗi file update phải bắt đầu bằng YAML front matter:

```yaml
---
skill: reading
operation: upsert
source_file: docs/aptis/updates/reading/20260911-reading-p1-additions.md
---
```

- `skill`: `reading`, `listening`, `speaking`, hoặc `writing`.
- `operation`: chỉ chấp nhận `upsert` (không hỗ trợ `delete`).

### Marker source_key
- **Câu sửa nội dung**: Phải có marker chỉ rõ `source_key` hiện tại:
  ```html
  <!-- source_key: reading-p1-set001-q001 -->
  ```
- **Câu mới chưa có key**: Để trống marker comment, hệ thống sẽ tự sinh `source_key` ổn định tiếp theo và yêu cầu người dùng duyệt `--approve-generated-keys`.

---

## 2. Các Bước Thực Hiện Import Incremental

### Bước 1: Kiểm Tra Dry-Run Preview

Chạy lệnh dry-run để kiểm tra preview tác động mà không ghi file/database:

```powershell
node scripts/import_incremental.js --file "docs/aptis/updates/reading/20260911-reading-p1-additions.md" --dry-run
```

Hệ thống sinh báo cáo JSON tại:
`reports/incremental/<file-slug>-dry-run.json`

Báo cáo cho biết:
- `total_parsed`: tổng số câu đọc được.
- `proposed_inserted`: số câu dự kiến INSERT.
- `proposed_updated`: số câu dự kiến UPDATE.
- `proposed_unchanged`: số câu dự kiến không đổi.
- `generated_source_keys`: danh sách key mới tự động đề xuất.

### Bước 2: Duyệt Key Mới & Sinh Incremental Seed SQL

Nếu có câu hỏi mới chưa có `source_key`, chạy lệnh có cờ `--approve-generated-keys`:

```powershell
node scripts/import_incremental.js --file "docs/aptis/updates/reading/20260911-reading-p1-additions.md" --generate-seed --approve-generated-keys
```

Lệnh này sẽ:
1. Ghi tự động marker `<!-- source_key: ... -->` vào file update markdown.
2. Cập nhật manifest tại `docs/aptis/manifests/<skill>.json` (chỉ merge, **không prune**).
3. Sinh file SQL seed riêng tại: `supabase/incremental/<timestamp>_<skill>_<name>.sql`.

### Bước 3: Import Seed SQL vào Database (qua Docker psql)

Chạy lệnh PowerShell nhập file SQL seed vào container Postgres local:

```powershell
Get-Content -Raw '.\supabase\incremental\<timestamp>_<skill>_<name>.sql' | docker exec -i supabase_db_OnAptis psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

---

## 3. Quy Trình Kiểm Tra & Xác Nhận

### Kiểm tra Inserted / Updated / Unchanged
Trong file SQL seed và sau khi thực thi SQL, kiểm tra bảng log `aptis_import_runs`:

```sql
SELECT source_file, skill, status, total_parsed, inserted_count, updated_count, unchanged_count, started_at
FROM public.aptis_import_runs
ORDER BY started_at DESC
LIMIT 5;
```

### Chứng Minh Record Ngoài Update File Không Bị Ảnh Hưởng
1. **Zero-Write Clause**: SQL Upsert sử dụng `WHERE aptis_questions.content_hash IS DISTINCT FROM EXCLUDED.content_hash`. Các record ngoài update file hoàn toàn không xuất hiện trong câu lệnh `INSERT ... VALUES` của file seed incremental.
2. **Manifest Preservation**: File manifest `<skill>.json` giữ nguyên 100% các key cũ không xuất hiện trong file update file.
3. `updated_at` của các câu hỏi cũ không nằm trong file update được giữ nguyên tuyệt đối.

---

## 4. Quy Tắc An Toàn & Giới Hạn

1. **Không hỗ trợ Xóa tự động (`operation: delete`)**: Phase 4 chỉ hỗ trợ thêm (`INSERT`) hoặc cập nhật (`UPDATE`).
2. **Đồng nhất Skill**: Không trộn nhiều skill trong cùng một file update file.
3. **Canonical Hash Contract**: Sử dụng chung thuật toán SHA-256 canonical JSON serialization từ `scripts/lib/canonical-hash.js`.
