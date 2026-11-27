# Salty's voice

Salty's recordings come from OpenRouter speech (ADR 0013), not Piper. Every script here that calls OpenRouter runs
**inside the server's container**, which holds `OPENROUTER_API_KEY` and the data folder, so the key never leaves the server.
Scripts not baked into the image are piped in:
```bash
ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/<script>.mjs
```

## The pattern: one brief, every tool
**[content/voice/brief.json](../../content/voice/brief.json) is the single source for Salty** (owner, 2026-11-27: "make it
as much of a pattern as possible"). It holds the voice (`google/gemini-3.8-flash-tts:Laomedeia`, the only voice) and its
exact directions, the persona, the owner's writing rules, what each spice level means, the keeper lines, and every moment
Salty speaks: when it plays, what's on the TV, what comes right after, the line's job, a word limit and a target count.
Change Salty there, never inside a script: every tool reads it.

| Step | Tool | Reads from the brief |
|---|---|---|
| See what's short | `node tools/voice/coverage.mjs` (`--short`) | moments, targets |
| Draft | `docker exec smartmouth node tools/voice/draft-lines.mjs` (`MOMENTS=`, `SPICES=`, `MAX_USD=`) | everything: Grok writes ~1.6x the gap, another model judges against the rules and keeps the best |
| Review | [build-review.py](build-review.py): the Keep/Cut/Fix page | moment labels and context |
| Add | curated lines into [lines.json](../../content/voice/lines.json), new ids | |
| Record | `docker exec smartmouth node tools/voice/voice.mjs bank` | the voice and its directions |

`lines.json` holds **every game's lines** (trivia's plain moments, Snake Manor's `sm-*`): replace only your own game's
moments. A new game adds its moments to the brief with the same fields. Rewritten lines get a **new id** (the review page
and the recordings are keyed by id). Recording names hash the exact direction text, so editing a direction re-records
everything in that voice: only do it on purpose.

## Bank (everything the game says)
```bash
docker exec -e MAX_USD=5 smartmouth node tools/voice/voice.mjs bank     # voice and slot come from the brief
```
Makes every line in `content/voice/lines.json`, plus, for every live question, its prompt, its answers (picture questions
only) and its follow-up line. Little questions use a warmer direction. Files that already exist are kept, so a re-run only
makes what's new or changed. `SLOT` (`female` or `male`) picks which room voice it fills: it writes
`DATA_DIR/voice/manifest-<slot>.json`, which the server picks up within 10 seconds. The manifest stores each line's text
(`lineText`), and a line's clip only plays when its words match the line, so a rewrite can't play an old joke under a new
caption. `DRY=1` counts clips and characters without making anything; `MAX_USD` stops at that much spend.
Don't deploy while a bank runs: the restart kills it.

**New questions are voiced automatically**: when the generator publishes questions, the server runs the bank for every
voice in `SALTY_VOICES` (server `.env`, e.g. `female=google/gemini-3.8-flash-tts:Laomedeia`).

## Auditions (pick a voice by ear)
- `voice.mjs audition`: one line in five styles (snarky, mean, indifferent, nice, cheerful) by every voice in `VOICES`;
  the line and styles are in [audition-styles.json](audition-styles.json). Page at `/media/voice/audition*/`.
- [audition-models.mjs](audition-models.mjs): the same four jokes across different speech models (ElevenLabs, Fish Audio
  Drama, Microsoft MAI-Voice, Grok Voice, Gemini). This is how Gemini 3.8 Flash won.
- [audition-gemini.mjs](audition-gemini.mjs): the same jokes across all 30 Gemini 3.8 Flash voices with the upbeat direction.

A voice is written `<model>:<voice>`. ElevenLabs acts from tags in the text (`[sighs]`) and returns mp3; its stock
voices retire on 2026-12-31. Gemini and Fish Audio act from a written direction (tags become delivery cues and are
stripped from the spoken text); Gemini returns wav.

Voices must be stock or designed voices. Never a clone or an imitation of a real person (ADR 0013, 0014).
