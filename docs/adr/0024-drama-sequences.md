# 0024. Drama sequences: timed reveals with paired sound and picture, two-part lines, Full or Quick

- **Status:** Proposed
- **Date:** 2026-11-27

## Context
The owner wants Snake Manor to be "overly theatrical and dramatic with sound design, visuals, and some pauses for
tension build up" (2026-11-27). They also want "animations in line with the sound design" (2026-11-27). Trivia's
reveals are quick stings. Snake Manor's banishments, votes, nights and unmasking are the point of the game, and they
need pacing.

Two constraints shape how this is built:
- **The server owns the clock** (ADR 0004), and a TV can reconnect mid-reveal.
- **Salty's lines are recorded ahead of time** (ADR 0013), but players type their own names (ADR 0016). A recorded
  line can't say a name.

A playable banishment shows the intended pace and pairing: "Hear the reveal" in
[docs/design/mockups/snake-manor.html](../design/mockups/snake-manor.html) (private artifact:
https://claude.ai/artifact/UR6VZ46KUoY3fcriACf42k). The full sound palette and beat sheets are in the "Drama:
sound, light and the pause" section of the [design doc](https://claude.ai/artifact/2vHrDkftuZKsf1YBcc5QHg).

## Decision
- **A reveal is a sequence:** a list of timed cues in the host view, each with a server timestamp. A cue can be a
  Salty clip, a sound, or a visual state. Two consequences:
  - A TV that reconnects starts at the current beat, not from the top.
  - The phase's deadline falls after the sequence ends.
- **The pause comes before the answer, never after.** The longest silence of a reveal sits right before the word
  lands. Once it lands, Salty reacts and the game moves on.
- **Every sound has a picture,** timed to the same moment:

  | Sound | What the TV does |
  |---|---|
  | each heartbeat | the light throbs |
  | quill scratches | the name writes itself, one stroke per scratch |
  | the held silence | everything freezes, even the candle flames |
  | the bell | a ring of light spreads and the room shakes |
  | the hiss | the serpent draws itself |
  | each candle puff | one candle goes out |
  | Salty speaking | his seal pulses |

  The word players must read (a name, a role) lands still, as design guide §5.5 requires. Only light and background
  layers move.
- **Salty's reveal lines come in two parts:** a setup clip and a payoff clip ("The one we cast out... was...", then
  "a Snake."). The platform sets the pause between them; it isn't baked into the audio.
- **Recorded reveal lines never say a player's name.** The TV shows the name. Saying a typed name would need live
  speech for every reveal, which stays an open question (ADR 0013).
- **Full drama or Quick** is a room setting. Quick cuts every held pause to a third. Either way, OK on the remote or
  Skip on the admin phone jumps straight to the result.
- **Drama budget:** about 2.5 minutes of a 35-minute game. Each phase gets one big moment, and the rest of it stays calm.
- **Sounds carry a spice level,** like lines (ADR 0014). At Spicy, with Kids in the room, it's spooky but not scary:
  the bell, wind and candles stay, and the screams, the door slam and the red flash go.
- **Accessibility:**
  - every meaningful sound has a caption ("[a bell tolls]")
  - reduced motion turns movement into fades
  - nothing flashes faster than 3 Hz
- **The sound bank** is made ahead of time and levelled with the existing stings (design guide §4,
  `tools/sounds/generate.mjs`). Phones stay silent.

## Consequences
- Reveals are deterministic and replayable from the cue list, which makes them testable without a TV.
- Line writing doubles for reveal moments, since each needs a setup and a payoff.
- The host view grows a "sequence" field. Trivia can adopt it later for its own big moments.
- 2.5 minutes of drama is a real cost. Quick mode and Skip are the release valves.

## Alternatives
- **Animations driven by the TV's local clock:** these break on reconnect and drift from the server's deadlines.
- **One audio file per reveal, with the pause baked in:** Quick mode couldn't shorten it, and the sound couldn't be
  synced to visual beats.
- **Live speech so Salty can say names:** slower, costs money per reveal, and sends names to AI. That stays with the
  ADR 0013 open question.

## Where it lives
`packages/protocol` (the sequence and cue types), `apps/web/src/games/snakes/` (planned: the sequence player),
`apps/server/src/voice.ts` (two-part clips), `content/voice/lines.json`, `tools/sounds/`.
