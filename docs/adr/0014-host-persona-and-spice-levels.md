# 0014. The host persona and spice levels: clean for kids, dirty for grown-ups

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants the host "snarky and funny, a total candy ass", with the energy of a swaggering film-pirate
rogue crossed with an exasperated stand-up comic. It should be clean or dirty depending on the age group (2026-11-26).
The same host has to work for a 4-year-old and for an adults-only night.

## Decision
- **Salty** (working name) is an **original character**: a washed-up ex-captain hosting trivia from a couch, all
  swagger and no spine. He takes the *energy* of those two archetypes, never a likeness. No actor's or comedian's
  name, catchphrases, voice or look, in prompts or in output. The full persona and writing rules are in the
  [design guide §3](../design/design-guide.md#3-the-host-salty).
- **Four spice levels:** Mild (G), Spicy (PG), Hot (PG-13), Filthy (R), defined with examples in the design guide.
- **The room's level is the lower of** the host's chosen level and the **cap from the youngest band present**:
  Little → Mild, Kids and Tweens → Spicy, Teens → Hot, Grown-ups only → Filthy, which a grown-up must turn on.
  The cap updates live when someone joins. A 4-year-old walking in mid-game turns an R-rated room down to G at the next line.
- **Every line and question carries a level**, and the server never picks one above the room's level. This is a server rule with a test,
  not a convention in the UI.
- **Rules that hold at every level:** he punches up or at himself, never mocks who a player is, never targets real
  people, and never uses slurs, sexual content about players, politics or religion. Kids always beat him.
- **Captions at Filthy are bleeped** (owner, 2026-11-26). Spoken swearing is real, but in the caption each swear word
  becomes a pill of exactly four `★`, so its length doesn't give the word away. The voice file keeps the real word, and the caption
  text is bleeped from a word list when the line is saved.

## Consequences
- The game's tone can go from preschool to adults-only without separate products.
- Line-writing prompts must state the level, the moment and the rules, and the review queue shows the level next to each line.

## Alternatives
One clean host for everyone: loses what the owner asked for. A separate adult mode as its own app: two of everything.

## Where it lives
`packages/protocol/src/spice.ts`, `apps/server/src/voice.ts` (picking lines), [design-guide.md §3](../design/design-guide.md).
