# 0009. The Little seat: pictures, read aloud, no timer, playable on the TV remote

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Three- and four-year-olds can't read or handle a timer, may not have a phone, and lose interest fast. The
owner's Crayon Box rules for toddlers (pictures not words, big targets, no failure screens) apply here too.

## Decision
- **Little questions are picture questions.** Each has two or three answers, and each answer is a picture from the reviewed image set
  (ADR 0011) with its word underneath for the grown-ups. Topics: colours, animals and their sounds, shapes,
  counting to 5, big and small, what goes together, and everyday objects.
- **Salty reads everything aloud:** the question, then each picture's name as it gets focus. Little lines are
  always at Mild spice (ADR 0014).
- **No timer** for a Little's question, and no penalty for a wrong pick. They hear "ooh, so close!", see the
  right picture bounce, and still get a small point for playing.
- **Three ways to play:**
  1. **The TV remote seat:** the Little plays on the TV itself, using left and right to move between pictures and OK to pick.
     This seat needs no phone and is the expected default.
  2. **Kid mode on a grown-up's phone:** only the pictures can be tapped. A long press on the top corner leaves kid mode.
  3. **A tablet** in kid mode.
- **A Little player always ends on a win screen** with a badge, whatever the scores (design guide §6).

## Consequences
- Picture questions need images that are made ahead of time and reviewed (ADR 0011). They're the slowest content to build.
- The remote seat gives the TV screen two jobs during a Little's turn. Turn rounds keep that simple.

## Alternatives
The Little plays on a phone only: many won't have one, and a phone in a 3-year-old's hand ends badly. A parent answers
for them: then the kid isn't playing.

## Where it lives
`packages/games/trivia/` (turn rounds, Little questions), `apps/web/src/host/` (remote seat), `apps/web/src/play/`
(kid mode).
