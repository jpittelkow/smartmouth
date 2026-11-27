# 0016. Privacy: names stay in the room, nothing identifying in the repo, no names to AI by default

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Kids play, the server is public (ADR 0015), and AI calls send text to outside companies. The owner's other kids'
apps keep kids' identities out of the repo (Crayon Box) and out of AI calls (colors).

## Decision
- **Player names, bands and avatars live only in room memory** and in that phone's `localStorage`. They're never
  written to the database or logs, and they're deleted with the room (ADR 0005). Logs record room codes and counts only.
- **Nothing sent to an AI model contains a player's name** by default. Live lines (ADR 0013) refer to "you", "Blue"
  (the seat colour) or the team. A setting, **"Salty can say names"** (off by default, Grown-ups-only rooms), allows
  names in live lines. It's never allowed when a Little or Kid is in the room.
- **The repo never contains anything that identifies the family's kids**: no names, nicknames, birthdays, schools,
  photos or device names. This covers docs, code, tests, sample data and commit messages. Test data uses made-up seat names
  ("Blue Blob", "Captain Test"). This is the same rule as Crayon Box's CLAUDE.md.
- **No analytics or telemetry**, and no third-party scripts on the phone or TV pages. Fonts are self-hosted.

## Consequences
- Live roasts are a bit less personal unless grown-ups opt in.
- Play stats are per question, never per person (ADR 0010).

## Alternatives
Saved player profiles across nights: nicer for recurring family players, but it means storing kids' data. It can be
revisited as an on-device-only feature.

## Where it lives
`apps/server/src/rooms.ts`, `apps/server/src/log.ts`, [CLAUDE.md](../../CLAUDE.md) (privacy rule).
