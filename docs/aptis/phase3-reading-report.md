# Phase 3A Initial Import Report — Reading Skill

**Document Version**: 6.0.0  
**Source File**: `docs/02-reading.md`  
**Target Database**: Supabase (Aptis Practice System Schema)  
**Execution Mode**: Dynamic Structural Assertion & Lower-Bound Baseline Protected Importer  

---

## 1. Dynamic Summary of Identified Reading Parts

| Part | Heading in Document | Question Type | Practice Sets | Total Questions / Tasks |
|---|---|---|---|---|
| **Part 1** | `Part 1: Sentence Comprehension` | `multiple_choice` | 29 Sets | 143 Questions |
| **Part 2** | `Part 2-3: Text Cohesion` | `sentence_ordering` | 60 Sets | 60 Tasks (Ordering) |
| **Part 4** | `Part 4: Opinion Matching` | `opinion_matching` | 24 Sets | 168 Questions (Matching) |
| **Part 5** | `Part 5: Long Text Comprehension` | `heading_matching` | 24 Sets | 168 Questions |

> **Total Reading Items Parsed**: `539` across `137` Practice Sets.

---

## 2. Structural Integrity & Lower-Bound Baseline Safeguards

- **Baseline Safeguards**: Baseline total items (539) act as lower bounds. Parsing will fail if total parsed items drop below baseline, but naturally allows incremental growth.
- **Part 1**: 143 `multiple_choice` questions (First 5 keys preserve Phase 2 keys `reading-p1-set001-q001`..`q005` and hashes).
- **Part 2**: 60 `sentence_ordering` tasks (`reading-p2-set001-q001` .. `reading-p2-set060-q001` environment).
- **Part 4**: 168 `opinion_matching` questions (`reading-p4-set001-q001` .. `reading-p4-set024-q007`). Stale `reading-p3-*` invalid keys cleaned up.
- **Part 5**: 168 `heading_matching` questions (`reading-p5-set001-q001` .. `reading-p5-set024-q007`).

---

## 3. Phase 2 Key Hash Verification (First 5 Questions)

| Question Source Key | Content Hash | Phase 2 Baseline Match |
|---|---|---|
| `reading-p1-set001-q001` | `2758ab0ce7b422ce11c3bba7aace503e788db6035d61a51a0bdb08ff058fface` | VERIFIED EXACT MATCH |
| `reading-p1-set001-q002` | `dd0f77c283cc8d4e2e03293baa2257af40b483050120be21a8e8a401932f82dc` | VERIFIED EXACT MATCH |
| `reading-p1-set001-q003` | `18c29a5a6afcbbbec7ed1e48f7577c86ff6862584b9adb9ca3b398f30ef7a388` | VERIFIED EXACT MATCH |
| `reading-p1-set001-q004` | `08c53b6d311eee121aed566529a836f4a813457e5d42d4f06ae8ecb2b6748e05` | VERIFIED EXACT MATCH |
| `reading-p1-set001-q005` | `1ab5a5baf82529adda3872f64105aa0c07bde5e8d1a6b2be94eafac24a223822` | VERIFIED EXACT MATCH |

---

## 4. Execution Commands for User

### Importer Lệnh PowerShell (Chạy offline nếu muốn sinh lại):
```powershell
Set-Location 'D:\OnAptis'
& 'C:\Program Files\nodejs\node.exe' '.\scripts\import_reading.js'
```

### Supabase Local DB Seed Lệnh Docker PowerShell:
```powershell
Get-Content -Raw '.\supabase\seed_reading.sql' | docker exec -i supabase_db_OnAptis psql -U postgres -d postgres -v ON_ERROR_STOP=1
```
