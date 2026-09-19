# Tài Liệu API & Secure Data Access Layer APTIS (Phase 5)

Tài liệu này định nghĩa kiến trúc Data Access Layer, TypeScript Data Models, Client Services, và Ranh Giới Chấm Bài Bảo Mật thông qua Supabase Edge Function cho 4 skill APTIS (**Reading, Listening, Speaking, Writing**).

---

## 1. Ranh Giới Bảo Mật Kiến Trúc (Vite SPA Client Boundary)

- **Frontend Scope (`src/`)**: Dự án sử dụng Vite SPA. Mọi mã nguồn trong `src/` đều được đóng gói thành client JavaScript bundle trên trình duyệt. Do đó:
  - **Tuyệt đối không sử dụng `SUPABASE_SERVICE_ROLE_KEY`** trong `src/`.
  - **Tuyệt đối không tạo admin Supabase client** trong `src/`.
  - **Không truy vấn trực tiếp** các bảng riêng tư (`aptis_question_answers`, `practice_response_evaluations`) từ `src/`.
- **Backend Scope (`supabase/functions/submit-practice/`)**: Chuyển toàn bộ logic chấm bài riêng tư và đọc đáp án sang **Supabase Edge Function** thực sự chạy trên server Deno Edge Runtime.
  - Edge Function tự động nạp `SUPABASE_SERVICE_ROLE_KEY` từ biến môi trường của server.
  - Kiểm tra Auth token của người dùng qua `Authorization: Bearer <token>`.
  - Thực hiện chấm điểm tự động cho Reading / Listening và tạo trạng thái `pending` cho Speaking / Writing.
  - Cập nhật trạng thái `practice_attempts` và trả về lời giải/đáp án **sau khi nộp bài thành công**.

---

## 2. Cấu Trúc Các File Đã Tạo/Cập Nhật

1. [`src/lib/supabaseClient.js`](file:///d:/OnAptis/src/lib/supabaseClient.js) - Browser Supabase Client với Lazy Initialization (`getSupabaseBrowserConfig`, `getBrowserSupabaseClient`). Tránh lỗi `TypeError` khi test bằng Node.
2. [`supabase/functions/submit-practice/index.ts`](file:///d:/OnAptis/supabase/functions/submit-practice/index.ts) - Supabase Edge Function thực sự cho Server Submission & Chấm Điểm.
3. [`src/services/submissionBoundary.js`](file:///d:/OnAptis/src/services/submissionBoundary.js) - Client Wrapper thuần túy gọi Edge Function `submit-practice` qua `supabase.functions.invoke`.
4. [`src/services/aptisService.js`](file:///d:/OnAptis/src/services/aptisService.js) - Client Service truy vấn dữ liệu công khai (Hỗ trợ Dependency Injection mock client).
5. [`src/services/practiceService.js`](file:///d:/OnAptis/src/services/practiceService.js) - Client Service quản lý attempt, autosave response khi `in_progress`, và bookmark.
6. [`src/types/aptis.ts`](file:///d:/OnAptis/src/types/aptis.ts) - TypeScript Data Types cho 4 skill và public UI payloads.
7. [`supabase/migrations/20260911000000_supplementary_rls_phase5.sql`](file:///d:/OnAptis/supabase/migrations/20260911000000_supplementary_rls_phase5.sql) - Supplementary RLS Migration tuân thủ chính xác quy tắc Authenticated-only của Phase 0.
8. [`tests/phase5-api.test.js`](file:///d:/OnAptis/tests/phase5-api.test.js) - Bộ unit test độc lập không cần `import.meta.env`, không cần kết nối DB hay .env.local.

---

## 3. Quản Lý Biến Môi Trường Trình Duyệt

Hàm `getSupabaseBrowserConfig(env)` tách biệt cấu hình môi trường:
- Nếu chạy trong Vite Browser: Nạp `import.meta.env.VITE_SUPABASE_URL` và `import.meta.env.VITE_SUPABASE_ANON_KEY`.
- Nếu thiếu biến môi trường khi gọi client: Tháo lỗi rõ ràng **`SUPABASE_BROWSER_CONFIG_MISSING`**.
- Khi import module: **Không khởi tạo Supabase client ngay**, ngăn chặn việc tự động nạp mạng không mong muốn.

---

## 4. Hướng Dẫn Chạy Test Dọn Dẹp

Tất cả unit tests chạy trực tiếp qua Node Engine:
```powershell
Set-Location 'D:\OnAptis'; & 'C:\Program Files\nodejs\node.exe' '.\tests\phase5-api.test.js'
```
