# Snake Manor's sounds and music

Snake Manor's sounds are synthesized on the TV for now (`apps/web/src/games/snakes/sound.ts`), and they sound like
it (owner, 2026-11-27: "more MIDI"). `sounds.mjs` makes real candidates to pick from by ear: two takes of each music
bed and sound effect from **Google Lyria 3** through OpenRouter (`google/lyria-3-clip-preview`, 30 s instrumental mp3,
$0.04 a clip, 2026-11-27).

Like `tools/voice/voice.mjs` it runs **inside the server's container**, which holds `OPENROUTER_API_KEY`, so the key
never leaves the server. It doesn't need a deploy; pipe the script in:
```bash
ssh root@192.168.1.4 "docker exec -i -e MAX_USD=1.5 smartmouth node --input-type=module -" < tools/sounds/sounds.mjs
```
It writes `DATA_DIR/media/sounds/audition/` and the page at `https://play.303.social/media/sounds/audition/index.html`.
The page plays the game's current synthesized sound beside each take, remembers your picks in the browser, and has
a **Copy my picks** button whose text you paste back to Claude to wire them in.

- `MAX_USD` stops the run once the key's usage has grown by that much (default 1.5). `TAKES` sets takes per cue (default 2).
- Takes that already exist are kept, so a re-run only makes what's missing. Delete a take's file to remake it.
- The cues and their prompts are at the top of `sounds.mjs`. Prompts describe sounds and moods only, never an artist,
  composer or existing piece.

**How Lyria answers on OpenRouter** (found 2026-11-27, not in their docs): the audio comes back only when the request
asks for it and streams: `POST /api/v1/chat/completions` with `"modalities": ["text", "audio"]` and `"stream": true`;
each chunk's base64 mp3 is in `choices[0].delta.audio.data`. Without both, you're charged and get only the text
`<instrumental>`.

If an effect doesn't work from Lyria (it's a music model), the page links CC0 and royalty-free libraries: the Sonniss
GDC bundle, Freesound (CC0 only), Pixabay sound effects. Anything used goes in `CREDITS.md`.

## Library effects (2026-11-27)
Lyria is a music model, so its "effects" came out as songs. The effects page,
`https://play.303.social/media/sounds/library/index.html`, offers CC0 sounds from Freesound instead: two or three per
cue, trimmed (silence off the front, capped per cue) and levelled with ffmpeg `loudnorm` (I=-18, beds are -20).
The candidates, authors and links are in [library.json](library.json). The page and clips were built on the dev PC
and copied to `DATA_DIR/media/sounds/library/`; Freesound previews were fetched slowly (its search rate-limits fast
callers with 429).
