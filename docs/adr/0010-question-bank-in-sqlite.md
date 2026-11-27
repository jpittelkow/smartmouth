# 0010. The question bank: SQLite, one question per band, with provenance and play stats

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Questions come from three places (hand-written seeds, AI generation, news), are written per age band (ADR 0008),
need review before they reach kids (ADR 0011), and go stale (news, ADR 0012). The server needs to pick fresh,
unrepeated questions fast.

## Decision
- **One SQLite file** in the data folder (`node:sqlite`, no ORM), with migrations as numbered `.sql` files.
- **A question row:** `id`, `band`, `kind` (`choice` | `picture` | later `free`), `category`, `prompt`,
  `answers` (JSON: text, optional image id), `correct` (index), `explain` (one line Salty can riff on),
  `source` (`seed` | `ai` | `news`), `source_ref` (the model and prompt id, or the article URL), `status`
  (`draft` | `review` | `live` | `retired`), `spice_max` (questions can be spicy too), `created_at`,
  `expires_at` (news), `voice_id` (the read-aloud clip, ADR 0013).
- **Play stats per question:** times asked, times right, average answer time, and the last time asked. These feed difficulty tuning and
  retiring bad questions.
- **Picking:** live, not expired, matching the band and the room's spice level, not asked in this room, and least recently asked first,
  with category variety. Questions used tonight are remembered per room (memory only), not per person.
- **Seeds live in the repo** as JSON (`content/seed/*.json`) and are imported at start-up. AI and news questions live only
  in the database (and its backup).

## Consequences
- One file is easy to back up with the owner's existing SQLite `.backup` routine on LoudMouth.
- Questions are original or AI-made, never copied from published quiz books or other games.

## Alternatives
Postgres: more to run for a few thousand rows. JSON files only: no stats, and review would be awkward.

## Where it lives
`apps/server/src/db.ts`, `apps/server/migrations/`, `content/seed/`.
