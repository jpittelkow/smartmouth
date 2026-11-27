# Salty's voice

Salty's recordings come from OpenRouter speech (ADR 0013), not Piper. `voice.mjs` runs **inside the server's
container**, which holds `OPENROUTER_API_KEY` and the data folder, so the key never leaves the server.

A voice is written `<model>:<voice>`:
- `elevenlabs/eleven-v4:<name>`: acts from tags in the text (`[sighs]`, `[scoffs]`). Returns mp3. ElevenLabs' stock voices
  (callum, bill, roger, george and others) **retire on 2026-12-31**. Files already made keep working, but new lines after
  that need another voice.
- `google/gemini-3.8-flash-tts:<Name>`: acts from a written description of Salty (`STYLE` in `voice.mjs`). Tags are
  stripped from its text so it doesn't read them out. Returns wav.

## Audition (pick a voice by ear)
The owner's format: one line, said in five styles (snarky, mean, indifferent, nice, cheerful), by every voice. The line and
the styles are in [audition-styles.json](audition-styles.json).
```bash
docker exec -e VOICES="google/gemini-2.5-pro-tts:Algenib,fish-audio/s2.1-pro:default" smartmouth node tools/voice/voice.mjs audition
```
This writes `DATA_DIR/media/voice/audition/`, and the page (voices x styles) is at
`https://play.303.social/media/voice/audition/index.html`. Fish Audio (`fish-audio/s2.1-pro:<voice>`) takes written
directions and returns mp3; `default` uses the model's own voice.

## Bank (everything the game says)
```bash
docker exec -e VOICE="elevenlabs/eleven-v4:callum" -e MAX_USD=5 smartmouth node tools/voice/voice.mjs bank
```
This makes every line in `content/voice/lines.json`, plus, for every live question, its prompt, its answers (picture questions only) and
its follow-up line. Little questions use a warmer, slower direction. Files that already exist are kept, so after you add
questions or lines a re-run only makes what's new. It writes `DATA_DIR/voice/manifest.json` last (outside the served folder), and the server picks it up within
10 seconds; there's no restart. Recording names are salted (`DATA_DIR/voice/salt`), so they can't be guessed from the text. Switching voices means running `bank` again with the new `VOICE`. `DRY=1` counts the clips and
characters without making anything. `MAX_USD` stops the run once the key's usage has grown by that much.

Voices must be stock or designed voices. Never a clone or an imitation of a real person (ADR 0013, 0014).
