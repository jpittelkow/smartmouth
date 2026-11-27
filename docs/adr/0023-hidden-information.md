# 0023. Hidden information: secrets live on one phone, and every phone looks the same

- **Status:** Proposed
- **Date:** 2026-11-27

## Context
Snake Manor (ADR 0022) is the first game with secret roles. Everyone sits in one room, can see the TV, and can
glance at the next person's phone. The grown-up running the room is also a player, holding the admin phone
(design guide §6). A secret can leak four ways:
1. through a view that carries too much
2. through a screen that looks different
3. through timing or sound
4. through the host's lines

ADR 0004 already sends each client only its own view. That's necessary, but on its own it isn't enough.

## Decision
These are platform rules. They apply to any game that has hidden information.

- **A secret reaches only the player it belongs to.**
  - Roles, the Snake chat, murder picks, shields and recruitment offers are in that player's `playerView` only.
  - The **host view** (TV) carries only public facts, and a role appears in it only from the moment of its reveal.
  - The **admin phone** gets the same public facts as the TV. It never sees roles, even though it runs the room.
- **Identical screens.** During any secret phase (night, role deal, recruitment), every living player's phone has
  the same layout:
  - the same header, text box, name grid and button, in the same places
  - the same server deadline (ADR 0004)

  Locking early doesn't release the phone; the screen stays up until the deadline. There's no seat-colour tint, no
  sound and no vibration on phones during a secret phase.
- **Hold to show.** A role card shows only while a finger is on the screen.
- **Mission reveals show totals only**, never who was right. That keeps sabotage untraceable.
- **The host never leaks.** Salty's line picker doesn't read hidden roles, except for the public reveal moments and
  the breakfast hints, which use only pooled night votes.
- **Replayable randomness.** `init` gets a seed from the platform (a new field in `packages/protocol/src/game.ts`).
  Role dealing and tie-breaks use only that seed, so a game can be replayed from its log (ADR 0004).
- **Typed text.** Free text is a new kind of intent, used by the Snake chat and the Guest notes:
  - it's capped in length (planned: 140 characters)
  - it's rate-limited like other intents
  - it stays in room memory only, like names (ADR 0016), and is never logged
- **Tests that must exist before the first Snake Manor playtest:**
  - no player view ever contains another player's role
  - neither the host view nor the admin view contains a role before its reveal
  - every night screen has the same shape and deadline for every living player
  - no Salty line is chosen based on a hidden role

## Consequences
- Any later hidden-role game gets these guarantees for free.
- View types need care: one shared "night screen" shape, with the secret part as its contents rather than a
  different layout.
- Adding a seed to `init` touches the game interface that trivia also uses. Trivia can ignore the seed.
- Free text is the first player-written content shown to other players. It's shown only to other Snakes, and it's
  never voiced or sent to AI.

## Alternatives
- **Players leave the room or close their eyes at night:** this is how tabletop games do it. It's awkward, slow,
  and impossible with a 7-year-old in the room.
- **The TV hides secrets but the admin phone sees everything:** the admin is a player, so that would spoil the game
  for whoever holds it.
- **Different screens per role, kept short:** any visible difference at all is a tell.

## Where it lives
`packages/protocol/src/game.ts` (the seed, typed-text intents), `apps/server/src/rooms.ts` (admin and host views),
`apps/server/src/voice.ts` (role-blind line picking), the tests beside them. Night screens are mocked in
[docs/design/mockups/snake-manor.html](../design/mockups/snake-manor.html) under "The identical night". The
write-up's "Night and the identical-phone rule" section is in the
[design doc](https://claude.ai/artifact/2vHrDkftuZKsf1YBcc5QHg).
