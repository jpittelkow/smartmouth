# 0019. Build order

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
There's a lot here: platform, game, TV app, content pipeline, voice, hosting. Building in the wrong order means
polishing things that can't be played yet.

## Decision
**Milestone 1: playable on the couch with hand-made content**
1. Platform skeleton: rooms, join by code, the lobby on the host screen, reconnects. Works in two browser tabs.
   *(Scaffolded 2026-11-26.)*
2. Trivia v1: everyone-answers and turn rounds, about 100 hand-seeded questions across all five bands, and scoring with handicaps.
   *(Rules, platform and screens built 2026-11-26, with 39 seed questions so far; the question library in /admin came first.)*
3. TV shell on a real Android TV, with the Little seat on the remote.
4. Salty v0: audition and pick a voice, a first line bank of about 150 lines across the spice levels, question reads for the
   seeds, and the playback queue with captions.
5. Deploy on the home server behind the tunnel, on the owner's domain. First family playtest.

**Milestone 2: content that stays fresh**
6. The admin page: review queue, line bank, settings, spend.
7. The AI question pipeline (write, check, review) and Little picture generation.
8. Current-events questions (ADR 0012).
9. Optional live roasts (ADR 0013).

**Milestone 3: game two**, chosen by the owner, which tests ADR 0006.

## Consequences
- The first playtest has real voice and real kids, before any AI pipeline exists.

## Alternatives
AI pipeline first: lots of content and nothing to play it in.

## Where it lives
This file. Progress is tracked in [docs/memory/project-state.md](../memory/project-state.md).
