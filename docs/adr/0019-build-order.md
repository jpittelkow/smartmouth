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

**Milestone 3: game two, Snake Manor** ([ADR 0022](0022-game-two-snake-manor.md), chosen by the owner on 2026-11-27),
which tests ADR 0006. Planned 2026-11-27. The platform is still hard-wired to trivia: `startGame` refuses any other
game ID, and Salty's line picker imports trivia's rules. So the first step makes room for a second game.

10. **Platform ready for a second game** (no Snake Manor yet):
    - the runtime picks a game from the registry instead of assuming trivia
    - Salty gets the current moment from the game module, not from trivia's rules
    - `init` gets a random seed (ADR 0023)
    - a typed-text intent with a 140-character cap and a rate limit
    - a rule and a test that the admin phone sees only what the TV sees

    Done when trivia runs through the shared path unchanged and `npm run check` passes.
11. **Snake Manor rules, headless** (`packages/games/snakes`):
    - the role deal (Kids always Guests) and the round loop
    - the Round Table vote and its tie rules, banishment, and the night murder
    - shields, Ghosts, both kinds of recruitment, and the endgame vote
    - missions stubbed out
    - the four ADR 0023 tests, plus simulated full games with bot players at every size from 5 to 10

    Done when a whole game plays out in tests and replays exactly from its seed.
12. **Plain screens and the first playtest:**
    - bare TV and phone views
    - the identical night screens (free-text chat and tap chips)
    - hold-to-show role cards
    - the Round Table vote and reveal

    Done when six grown-ups play a full game on the couch with a dummy mission.
13. **Missions:**
    - trivia's question picking moved into a shared helper
    - "Everyone answers" with the target, pot, Daggers, Overboard and shields, with reveals that show totals only
    - then The Chain and Pairs

    Done when a mission can be sunk untraceably, in a test and in a playtest.
14. **The look** ([design guide §8](../design/design-guide.md#8-snake-manor)):
    - the three fonts, self-hosted
    - the coat-of-arms component, vellum cards, the candle timer, the wax-seal votes and the night palette

    Done when the screens match [the mockups](../design/mockups/snake-manor.html) and the book face reads at 3 m on
    the office TV.
15. **Salty as Lord of the Manor:**
    - about 20 new moments per spice level, with reveal lines in two parts
    - a grown-up reviews the lines, then the voice bank is generated
    - a test that the line picker never reads hidden roles

    Done when every phase has voiced lines at every spice level the game allows.
16. **Drama** ([ADR 0024](0024-drama-sequences.md)):
    - the sequence type in the protocol, and the TV's sequence player
    - a recorded sound bank paired with the visuals
    - Full or Quick, and Skip
    - resuming mid-reveal after the TV reconnects

    Done when a real-TV banishment matches the demo's timing and pulling the TV's plug mid-reveal resumes at the right beat.
17. **Family playtest and tuning:**
    - kids in the room
    - tune the knobs: night length, mission target, the Dagger menu, how often shields come up
    - the owner accepts or revises ADRs 0022 to 0024
18. **Briefings** ([ADR 0025](0025-briefings-explain-before-you-play.md)), after the first owner runs:
    - a `briefing` stage before the first mission of each format, the first Round Table, the first night and
      the endgame; no clock runs during one
    - a rules card on the TV (three steps, win/lose, an example) and the same steps on the phones
    - Salty's briefing lines at every spice level, reviewed, then voiced; the old how-to lines retire

    Done when a first-time player can say what to do at each new stage without asking, and no question timer starts
    while Salty explains.

Steps 14 and 15 change styles and lines, not rules, so they can run alongside step 13 once step 12 is done. Step 16
needs step 15's two-part clips. The playtest at step 12 comes before any polish on purpose: the riskiest question is
whether the hidden-role loop is fun with this family.

## Consequences
- The first playtest has real voice and real kids, before any AI pipeline exists.
- Game two is playtested in plain screens before any of its look, voice or drama is built.

## Alternatives
AI pipeline first: lots of content and nothing to play it in.

## Where it lives
This file. Progress is tracked in [docs/memory/project-state.md](../memory/project-state.md).
