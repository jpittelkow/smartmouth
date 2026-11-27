# 0025. Briefings: Salty explains each new thing on a rules card before anyone plays it

- **Status:** Proposed
- **Date:** 2026-11-27

## Context
In the first full runs of Snake Manor, the owner said (2026-11-27) that "Salty is not explaining enough right now". They also said he "explains over a question vs an explanation slide before a mission".

The code bore that out:
- Salty's how-to lines (`sm-how-mission`, `-table`, `-vote`, `-night`) play while the stage is already running. The mission's explanation starts as the first question appears, so people must read, answer and listen all at once.
- The chain (round 2) and pairs (round 3) get only the generic mission line. Nobody tells the table how they work.
- Each how-to line is one or two short sentences, too little to teach a game.

The screens already say what to do now and next (ADR 0024, design guide §8), but a strip of text is not a lesson.

## Decision
- **A briefing is a stage of its own (`briefing`).** It runs before the first time the table meets something new, and once per game for each of these:

  | Brief | Before | Covers |
  |---|---|---|
  | `game` | the deal (the very start) | the whole game: Guests and secret Snakes who know each other, the round (mission, Round Table, night), Ghosts, who wins |
  | `mission-everyone` | the first mission | answer on your phone, right answers fill the pot, the target, a miss gives the Snakes a Dagger, the top scorer gets a secret shield, a Snake can secretly sink an answer |
  | `mission-chain` | the first chain | one player at a time, a run of right answers pays more, one wrong breaks the chain |
  | `mission-pairs` | the first pairs mission | your partner is on the TV, a pair scores only if both are right |
  | `table` | the first Round Table | argue out loud (or type), what the table knows, then a secret vote sealed as a letter; the letters open one by one, and the most-voted player leaves and shows their role; ties revote |
  | `night` | the first night | the TV goes dark and every phone looks the same; Snakes pick someone to vanish, Guests write a note about who they suspect, then lock; Ghosts bet; at breakfast we see who's gone |
  | `endgame` | the first End-or-banish vote | it ends only if every player picks End, then the masks come off |

- **No clock runs during a briefing.** The mission and its question timer start when the briefing ends, so nobody answers while Salty talks. The briefing lasts at least `BRIEF_MS` (12 s) and is held until Salty finishes, like a reveal stage. A grown-up can skip it with "Got it" (the phone's Next).
- **The TV shows a rules card,** a vellum card in the manor style with:
  - a title;
  - three numbered steps (I, II, III);
  - one "how you win / how you lose" line;
  - a small worked example (e.g. pairs: "Both right: +2. One right: nothing.").

  The card stays the same however long Salty talks.
- **The phones show the same steps** under "Listen to Salty". There is nothing to tap except the grown-up's "Got it".
- **Salty gets a briefing line per brief at every spice level:**
  - 2–4 sentences (about 12–18 s spoken), covering what to do, what wins, and the catch;
  - Mild and Spicy say "vanished", never "murdered";
  - no names, so the lines can be recorded ahead (ADR 0013, 0016);
  - reviewed by a grown-up before the voice bank is made (ADR 0011).

  Nothing is said over a mission question except the question itself: Salty reads it from its recording, as in Trivia (owner, 2026-11-27: the first question had a second explainer on it and wasn't read). The old `sm-how-*` and `sm-mission` lines retire.
- **The briefing is public information only (ADR 0023).** It runs before anything secret is decided. The night brief comes before the night's recruit choice, so the card can't hint at it.
- **Deterministic and replayable.** Which briefs have run is part of the game state (`briefed`), so a replay and a reconnecting TV see the same thing.

## Consequences
- The first round takes about 75 s longer (six briefs over a game, most in round 1). Repeat players can skip each card.
- The question timer can't eat into Salty's explanation.
- Every new brief means new recorded lines at each spice level.
- Later work: a lobby switch, "We know the rules", that skips every brief for a table that's played before. A tap per card covers it until then.

## Alternatives
- **Longer lines over the running stage:** what we had, and the reason for this ADR.
- **One long tutorial at the start:** too much to hold before anyone plays. The chain and pairs come rounds later, so teaching them when they appear sticks better.
- **A pop-up over the stage:** the timer and the question still show underneath, and people would start answering.

## Where it lives
- Rules: `packages/games/snakes/src/server.ts` (`briefing` stage, `BRIEFS`, `BRIEF_MS`) and `types.ts`.
- Salty's moments: `apps/server/src/adapters/snakes.ts` (`sm-brief-*`); lines in `content/voice/lines.json`.
- TV rules cards: `apps/web/src/games/snakes/SnakesHost.tsx` (`Briefing`). Phone screen: `SnakesController.tsx`.
- Build plan: [ADR 0019](0019-build-order.md) step 18.
