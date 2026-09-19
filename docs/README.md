# APTIS data files for Supabase

Use each skill file independently. Do not make Antigravity read the entire folder unless it needs to create the database schema or run a full validation.

## Files

- `01-vocabulary-grammar.md`
- `02-reading.md`
- `03-listening.md`
- `04-speaking.md`
- `05-writing.md`

## Updating later

When new questions are added, edit or upload only the relevant skill file. Ask Antigravity to process that one file and upsert its questions into Supabase. It must not delete or recreate data belonging to the other skills.

## Recommended import order

1. Create the Supabase schema once.
2. Import one skill file at a time.
3. Verify the result for that skill.
4. Move to the next phase only after verification succeeds.
