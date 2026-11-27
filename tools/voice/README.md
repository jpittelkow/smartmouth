# Salty's voice

Salty's recordings come from OpenRouter speech (ADR 0013), not Piper. Every script here that calls OpenRouter runs
**inside the server's container**, which holds `OPENROUTER_API_KEY` and the data folder, so the key never leaves the server.
Scripts not baked into the image are piped in:
```bash
ssh root@192.168.1.4 "docker exec -i smartmouth node --input-type=module -" < tools/voice/<script>.mjs
```

**Now (2026-11-27):** the owner's voice is **Gemini 3.8 Flash, "Laomedeia"** (woman), directed upbeat (`STYLE` in
`voice.mjs`), chosen for "the best timing by far". A man's voice (Zubenelgenubi) was picked but not recorded yet; the
"His voice" option still plays the older ElevenLabs Harry recordings.

## The voiceover loop
1. **Draft lines** with [draft-lines.mjs](draft-lines.mjs) (Grok 4.7). Its brief tells the writer, for every moment, what's
   on the TV, what Salty just said and what comes right after (reveal lines hand off to the fun fact; hello introduces
   Salty and the rules). It prints JSON candidates. Nothing is used as-is: a person curates.
2. **Curate** into [content/voice/lines.json](../../content/voice/lines.json). That file holds **every game's lines**
   (trivia's plain moments, Snake Manor's `sm-*`): replace only your own game's moments and keep the rest. The owner's
   rules from two reviews: greet first and end on a hype call; every line makes literal sense; an everyday situation with
   one specific, unexpected twist; a clear attitude; "another one", not "the new one".
3. **Review** with [build-review.py](build-review.py): it builds the Keep/Cut/Fix page (an Artifact with a small database;
   read the marks back with ArtifactData). Rewritten lines get a **new id**, so old marks don't attach to new words.
4. **Record** with `voice.mjs bank` (below). Then deploy if lines.json changed.

## Bank (everything the game says)
```bash
docker exec -e SLOT=female -e VOICE=google/gemini-3.8-flash-tts:Laomedeia -e MAX_USD=5 smartmouth node tools/voice/voice.mjs bank
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
