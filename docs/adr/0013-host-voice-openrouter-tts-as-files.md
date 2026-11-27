# 0013. The host's voice: OpenRouter speech, made ahead of time and played from files

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants the host voiced, **through OpenRouter like Crayon Box, not Piper** (2026-11-26). Crayon Box makes
its narrator with ElevenLabs v4 through OpenRouter's `POST /api/v1/audio/speech` (its ADR 0032 and
`tools/sounds/generate.mjs`), and picks voices by ear on an audition page. The host must sound snarky and funny
(ADR 0014). Speech calls take a second or more, so a game can't wait on them.

## Decision
- **Model:** `elevenlabs/eleven-v4` through OpenRouter (setting `AI_VOICE_MODEL`). Its audio tags (`[sighs]`,
  `[scoffs]`, `[laughs]`, `[sarcastic]`) carry the delivery. **The voice is chosen by ear:** an audition script makes
  the same 12 test lines in each candidate voice, and the owner picks one on an audition page, the Crayon Box way.
  Whichever is picked has to be a stock or designed voice. **No clone or imitation of a real person's voice**, and prompts
  never ask for one by name.
- **Every line is a file.** There are three kinds:
  1. **The line bank:** a few hundred reusable host lines (intros, reactions, transitions), each tagged with its
     moment, spice level (ADR 0014) and band. Written by an AI-assisted writing pass, then reviewed. The bank grows over time.
  2. **Question reads:** made when a question is approved (ADR 0011). The prompt, plus each answer for picture questions.
  3. **Explain riffs:** one short line per question from its `explain` field, made with the question.
- **Files** are MP3, levelled to one loudness, stored under the data folder by a hash of (model, voice, text), and
  described in a manifest row (id, text, spice, moment, model, voice, made_at). The same text is never paid for twice.
- **Playback on the TV only**, through one queue owned by the platform: one line at a time, droppable when the
  game moves on, skippable, ducking the music. Captions show the line's text.
- **Optional live lines** (off by default): during a reveal, the server may ask the text model for one fresh roast of
  the round's answers and voice it while the scoreboard animates. It's used only if it's ready in time, at the room's spice level,
  and without player names unless ADR 0016 allows them.
- **The tooling is in the repo**: `tools/voice/` (generate, audition, level). The key stays on the server, and jobs
  run inside its container, like Crayon Box.
- **Voice lifetime:** ElevenLabs retires default voices on 2026-12-31 (Crayon Box ADR 0032). If one of those is picked,
  the bank is made before then, or a long-lived voice is picked instead.

## Consequences
- The voice is instant in play and costs nothing per game, but every new line costs a speech call (paid once).
- The line bank decides how funny the game is. Writing and reviewing it is real, ongoing work.
- Rooms with players at different spice levels need lines at every level, so the bank is roughly 4× the lines.

## Alternatives
Piper or local TTS: ruled out by the owner. It's also flat for comedy. Live TTS for every line: latency, cost per game,
and unreviewed output in front of kids.

## Where it lives
`tools/voice/`, `apps/server/src/voice.ts`, the `voice_lines` table, `apps/web/src/host/voice.ts` (the queue).
