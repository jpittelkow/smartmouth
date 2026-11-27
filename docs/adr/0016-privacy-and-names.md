# 0016. Privacy: names stay in the room, nothing identifying in the repo, names to AI only for live lines

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Kids play, the server is public (ADR 0015), and AI calls send text to outside companies. The owner's other kids'
apps keep kids' identities out of the repo (Crayon Box) and out of AI calls (colors).

## Decision
- **Player names, bands and avatars live only in room memory** and in that phone's `localStorage`. They're never
  written to the database or logs, and they're deleted with the room (ADR 0005). Logs record room codes and counts only.
- **Salty can say players' names** (owner, 2026-11-26: "fine with saying any names"). Live lines (ADR 0013) may
  include the names players typed, in any room, which means those names are sent to the text and speech models through
  OpenRouter. A room setting, **"Salty says names"**, is **on by default**, and a grown-up can turn it off for a night with
  guests. Off, he uses "you", the seat colour or the team. Names are sent only for the line being made, and are never stored
  with the line or in logs.
- **The repo never contains anything that identifies the family's kids**: no names, nicknames, birthdays, schools,
  photos or device names. This covers docs, code, tests, sample data and commit messages. Test data uses made-up seat names
  ("Blue Blob", "Captain Test"). This is the same rule as Crayon Box's CLAUDE.md.
- **No analytics or telemetry**, and no third-party scripts on the phone or TV pages. Fonts are self-hosted.

## Consequences
- Live roasts can be personal ("Toast, that was tragic"), at the cost of sending typed names to OpenRouter and the
  model makers behind it.
- Play stats are per question, never per person (ADR 0010).

## Alternatives
Saved player profiles across nights: nicer for recurring family players, but it means storing kids' data. It can be
revisited as an on-device-only feature.

## Where it lives
`apps/server/src/rooms.ts`, `apps/server/src/log.ts`, [CLAUDE.md](../../CLAUDE.md) (privacy rule).
