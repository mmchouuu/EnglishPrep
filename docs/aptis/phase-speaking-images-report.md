# Phase Speaking Image Assets Storage Database and UI Fix Report

## Summary of Changes
- **Task**: Prepared image assets for Aptis Speaking, created storage migrations, updated importers & seeds, refactored data adapters, fixed UI photo rendering, and added static verification tests.
- **Physical Assets**: 145 physical JPG files (`image1.jpg` to `image145.jpg`) in `assets-source/speaking`.
- **Logical Content Blocks**: 147 image blocks.
- **Reused Files**:
  - `image14.jpg`: Reused in Part 2 Set 08 (`speaking-p2-set008-image1`) and Set 20 (`speaking-p2-set020-image1`).
  - `image143.jpg`: Reused in Part 3 Set 69 (`speaking-p3-set069-image1`) and Set 70 (`speaking-p3-set070-image1`).

---

## Created & Modified Files

| File Path | Action | Description |
|---|---|---|
| `scripts/prepare_speaking_images.js` | **NEW** | Script to parse `docs/04-speaking.md`, calculate SHA-256 hashes, verify existence, copy images to `public/assets/speaking`, generate manifest, and assert constraints. |
| `docs/aptis/manifests/speaking-images.json` | **NEW** | Image manifest containing 147 logical image records with SHA-256 hashes and storage object paths. |
| `supabase/migrations/20260913000000_speaking_images_storage.sql` | **NEW** | Supabase Storage migration creating `speaking-images` bucket, public read policy, and service-role write restriction. |
| `scripts/upload_speaking_images.js` | **NEW** | Server-side upload script with `--apply` flag, content hash check, and stats logging. |
| `scripts/import_speaking.js` | **MODIFIED** | Updated importer to construct 147 semantic image blocks and question bindings with public paths & metadata. |
| `supabase/seed_speaking.sql` | **MODIFIED** | Updated seed SQL matching 147 image blocks with idempotent `ON CONFLICT` zero-write logic. |
| `src/adapters/speakingAdapter.js` | **MODIFIED** | Refactored Part 2 view model (`imageVariants`, `activeVariantIndex`) and Part 3 view model (`combinedImage`). |
| `src/components/SpeakingPractice.jsx` | **MODIFIED** | Updated UI for Part 2 photo variant switcher buttons (`Photo 1` / `Photo 2`) and Part 3 single combined image rendering. |
| `tests/prepare-speaking-images.test.js` | **NEW** | Unit test suite asserting image preparation and manifest rules. |
| `tests/phase6b-speaking-integration.test.js` | **MODIFIED** | Comprehensive integration test suite covering all 22 static verification rules. |
| `docs/aptis/phase-speaking-images-report.md` | **NEW** | This completion report. |

---

## Breakdown by Skill Part

| Part | Title | Sets | Questions | Image Blocks | Layout / Behavior |
|---|---|---|---|---|---|
| Part 1 | Personal Information | 24 Core Stories | 149 | 0 | Text only. No image containers or placeholders. |
| Part 2 | Describe One Photo | 52 Sets | 156 | 75 | Photo description variants (`single_photo`). Render ONE active photo at a time with `Photo 1`/`Photo 2` toggles when 2 variants exist. |
| Part 3 | Compare Two Photos | 72 Sets | 216 | 72 | Single combined comparison image (`combined_pair`). Full-width `object-contain` rendering. |
| Part 4 | Abstract Topic | 58 Modules | 174 | 0 | Text only. No image containers or placeholders. |
| **Total** | | **206 Groups** | **695** | **147** | |

---

## Naming & Storage Conventions

- **Part 2 Destination Path**: `public/assets/speaking/part-2/set-XXX/photo-Y.jpg`
- **Part 2 Storage Object Path**: `part-2/set-XXX/photo-Y.jpg`
- **Part 2 Source Key**: `speaking-p2-setXXX-imageY`
- **Part 3 Destination Path**: `public/assets/speaking/part-3/set-XXX/comparison.jpg`
- **Part 3 Storage Object Path**: `part-3/set-XXX/comparison.jpg`
- **Part 3 Source Key**: `speaking-p3-setXXX-image1`
- **Content Hash**: SHA-256 computed strictly from raw file bytes. Excludes absolute paths, machine names, UUIDs, timestamps, or run IDs.

---

## Security & Database Mapping

1. **Sample Answer Security**:
   - `aptis_question_answers` remains private with no public RLS SELECT policies.
   - Frontend `speakingAdapter` strips all solution data pre-submission.
   - UI `PostSubmitSampleAnswer` component displays model answers ONLY after successful server-side submission.
2. **Supabase Storage Access**:
   - Bucket `speaking-images` has public read policy for practice UI image loading.
   - INSERT/UPDATE/DELETE restricted strictly to `service_role` key via upload scripts.
   - No `SUPABASE_SERVICE_ROLE_KEY` or secrets embedded in `src/`.
3. **Idempotent Zero-Write Strategy**:
   - PostgreSQL queries use `ON CONFLICT DO UPDATE WHERE ... IS DISTINCT FROM ...`.
   - Re-running seeds or importers against unchanged database produces 0 row writes.

---

Static Speaking image preparation, Storage, database and UI integration completed — runtime verification pending.
