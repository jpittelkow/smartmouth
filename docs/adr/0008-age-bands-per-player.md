# 0008. Age bands belong to each player, and scoring is fair across them

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants kids "as young as 3 or 4" to play, often with older kids and adults in the same game. One
difficulty for the whole room makes it boring for adults or impossible for preschoolers.

## Decision
- **Five bands, picked by each player on join** with picture buttons rather than a birthday: **Little 3–5, Kids 6–8,
  Tweens 9–12, Teens 13–17, Grown-ups 18+.** The band is stored on the seat, for this room only.
- **Every question is written for one band** (ADR 0010), not simplified from an adult question.
- **Two kinds of round** in trivia:
  - **Everyone answers:** each phone gets a question for its player's band at the same time. The TV shows the
    question for the oldest band present, with a strip saying "everyone's got their own question".
  - **Turn round:** the TV shows one player's question for their band ("Little's turn!") and reads it aloud. Others watch
    and can earn a small "helper" bonus by locking in the same answer, but they can't steal.
- **Handicapped scoring:** points are scaled by band, so a Little and a Grown-up can tie. The starting values,
  to be tuned in playtests, are: Little ×3, Kids ×2, Tweens ×1.5, Teens ×1.2, Grown-ups ×1. The speed bonus applies only
  to Tweens and up.
- **The room's spice cap** comes from the youngest band present (ADR 0014).

## Consequences
- The question bank needs to be deep in every band (ADR 0010, 0011), or the thin bands repeat fast.
- In "everyone answers" rounds the TV can't show everyone's question at once. It shows one, and the phones carry the rest.

## Alternatives
One difficulty for the whole room: the contest between the 4-year-old and the adults that the owner wants to avoid. Exact ages: more
than needed, and more personal data.

## Where it lives
`packages/protocol/src/bands.ts`, `packages/games/trivia/src/server.ts`, the join screen in `apps/web/src/play/`.
