# 0022. Game #2 is Snake Manor, a hidden-traitor game built on trivia missions

- **Status:** Proposed
- **Date:** 2026-11-27

## Context
The owner chose a hidden-traitor game for Game #2 on 2026-11-27. It's inspired by the TV show "The Traitors":
secret traitors among the players, Round Table votes to banish someone, and night "murders". It needs its own
name, rules and look, not the show's branding. It also has to work in a living room with one TV, where everyone
can see everyone else. That means the secret parts must happen on the phones (ADR 0023). It has to fit the
game-module interface (ADR 0006) and reuse the question bank where it can.

Related work from 2026-11-27:
- the design write-up, a Claude Doc: [Smart Mouth: Traitors Mode Design](https://claude.ai/artifact/2vHrDkftuZKsf1YBcc5QHg)
- the mockups: [mockups/snake-manor.html](../design/mockups/snake-manor.html) (private artifact:
  https://claude.ai/artifact/UR6VZ46KUoY3fcriACf42k)
- the session notes: [journal 2026-11-27](../journal/2026-11-27.md)

## Decision
- **Working name: Snake Manor.** There are three roles. The roles and the name are working names (see Open items).
  - **Guests** know only their own role. They win if the game ends with no Snake left alive, and the surviving
    Guests split the pot.
  - **Snakes** know each other. They win if at least one Snake is alive at the end, and the surviving Snakes take
    the whole pot.
  - **Ghosts** are murdered Guests. They keep playing for side points (below).
- **5 to 10 players.** The platform caps rooms at 10 players (ADR 0004).

  | Players | Snakes | Rounds before the endgame | Endgame size |
  |---|---|---|---|
  | 5 | 1 | 2 | 3 |
  | 6 | 1 | 2 | 3 |
  | 7 | 2 | 2 | 3 |
  | 8 | 2 | 2 | 4 |
  | 9 | 2 | 3 | 4 |
  | 10 | 3 | 3 | 4 |

  Each round has one banishment and one murder. There is **no murder on night 1 when there are 6 or fewer players**.
- **Age bands** (ADR 0008):
  - Tweens and older can be any role.
  - Kids (6–8) play, but are always Guests, and everyone is told so.
  - Littles are left out of the manifest's `bands`, so they sit this game out (ADR 0009).
- **The round loop** takes about 11 minutes. A game is 2 or 3 rounds plus about 8 minutes of setup and endgame,
  so 30 to 40 minutes in all.
  1. **Breakfast** (1 min): Salty reveals who was murdered, or that a shield saved them, and drops a hint drawn from
     the Guests' night notes.
  2. **Mission** (4 to 5 min): a trivia round for the pot.
  3. **Round Table** (4 min): 3 minutes of open debate in the room, then a secret vote on the phones. The votes are
     revealed one at a time on the TV. A tie goes to a revote between the tied players, and a second tie is decided
     at random.
  4. **Banishment** (30 s): the banished player's role is revealed.
  5. **Night** (1.5 min): 60 seconds of identical phone screens (ADR 0023), then the murder is locked in.

  The game checks for the endgame after every banishment and every murder. Banishing the last Snake ends the game
  at once, and the Guests win.
- **Missions** use questions from the existing bank, picked per band as in trivia.
  - **Pot and target:** every correct answer adds money to the pot. Each mission also has a target (about 75%
    correct). Hit it and the mission's bonus is banked too. Miss it and the Snakes earn a **Dagger**.
  - **Dagger:** buys one of a double murder, Silence (one player can't vote at the next Round Table), or Peek
    (learn whether one player holds a shield). Every sabotage shrinks the pot the Snakes hope to win.
  - **Overboard:** a Snake's main tool is a wrong answer. Each mission also gives the Snakes one Overboard, which
    quietly drops one teammate's answer from the count. The reveal shows only totals, so the Overboard can't be
    traced. Salty only says "one answer went overboard".
  - **Formats** to start: Everyone answers, The chain, and Pairs.
  - **Shields:** the mission's top scorer is offered a shield privately. A shielded player can't be murdered that
    night. The room is told that a shield was given, but not who has it.
- **Night:**
  - **The murder vote:** the Snakes pick one Guest. If they haven't agreed by the deadline, the most-picked name wins
    and a tie is broken at random.
  - **Guests** write a private suspect note and vote for a suspect. These feed Salty's breakfast hints.
  - **Ghosts** make a Ghost Bet on who the Snakes are.
  - **Recruitment:** after a Snake is banished, the surviving Snakes may offer one Guest a place on the next night.
    The offer arrives as that Guest's night screen.
- **The endgame:**
  1. At the endgame size, every living player votes in secret: End or Banish again.
  2. Only a unanimous End ends the game. Anything else runs one more Round Table with no mission and no night, and it
     stops at 2 players.
  3. Salty unmasks the survivors one at a time. The pot then goes to whichever side won.
- **Scores for the night** (ADR 0006): the pot is turned into points for the platform's scoreboard.
  - each winner gets their share of the pot
  - each correct Ghost Bet gets a small fixed bonus
  - a Guest who voted for a Snake at every Round Table they attended gets a "sharp eye" bonus

  Playtests set the exact numbers.
- **Salty hosts as "Lord of the Manor".** He has the same voice, snark and spice rules as before (ADR 0014,
  design guide §3). The persona and the new line moments are in
  [design guide §8](../design/design-guide.md#8-snake-manor). His line choices never depend on hidden roles (ADR 0023).
  At Spicy a murder is "vanished in the night", and at Hot and above it's "murdered".

## Consequences
- Game #2 reuses the question bank, per-band picking, Salty's voice queue, the spice cap and per-player views. Most
  of the new work is game rules, plus the platform additions in ADR 0023 and ADR 0024.
- It's the first real test of the game-module interface, as ADR 0006 expected.
- The voice bank needs about 20 new moments, and the sound bank needs the set in ADR 0024.
- Small rooms only get 2 rounds. That's acceptable for a 30-minute party game.

## Alternatives
- **The show's names and look:** ruled out. It needs its own identity.
- **Sabotage that only costs money:** this gives the Snakes no reason to risk it, because they want the pot too.
  Daggers make the trade real.
- **Murdered players sit out:** half an hour of nothing to do kills a party game. Ghosts keep them in.
- **One murder every night at every size:** a 6-player game would be over after one round.

## Open items (waiting on the owner)
1. Name: Snake Manor, Guests and Snakes, or something else (for example Two-Faced or Backstabbers).
2. Kids 6–8 as always-Guests, or Tweens and up only?
3. Snake chat as free text, or quick-chat only (names plus set phrases)?
4. If the last Snake is banished early, end the game at once (as written), or have Salty secretly recruit a new Snake?
5. Can Ghosts talk at the Round Table? As written, they can heckle but not vote.

## Where it lives
`packages/games/snakes/` (planned: manifest, rules, view types), `apps/web/src/games/snakes/` (planned: views),
`content/voice/lines.json` (new moments), and the mockups in
[docs/design/mockups/snake-manor.html](../design/mockups/snake-manor.html).
