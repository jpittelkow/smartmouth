# Credits

Sounds and music the game plays that we didn't make ourselves (design guide §4). Each entry: what it is, where it's
used, where it came from, and its license. The files live on the server in `DATA_DIR/media/sounds/game/`, not in this repo.

## Sound effects (Snake Manor)
All from [Freesound](https://freesound.org), released under **CC0 1.0** (no credit required; we credit them anyway).
Trimmed and levelled for the game (tools/sounds/README.md).

| Cue | Sound | Author | Used for |
|---|---|---|---|
| heartbeat | [Heartbeat 97 BPM](https://freesound.org/people/Cloud-10/sounds/688735/) | Cloud-10 | The build before a banishment lands |
| seal | [Stamp](https://freesound.org/people/kermite607/sounds/362623/) | kermite607 | Each vote seal breaking |
| quill | [Quill pen writing on hard paper various speed](https://freesound.org/people/marcoman89/sounds/194905/) | marcoman89 | A banished name writing itself; each seal |
| wind | [Halloween - Graveyard At Night Howling Wind](https://freesound.org/people/mistersherlock/sounds/159509/) | mistersherlock | Under the night music |
| candles | [Candle blow](https://freesound.org/people/JacobEmanuelMadrid/sounds/656818/) | JacobEmanuelMadrid | The candles going out when a Guest is banished |

## Music and the bell (Snake Manor)
Generated with **Google Lyria 3** (`google/lyria-3-clip-preview`) through OpenRouter on 2026-11-27, from our own
prompts in `tools/sounds/sounds.mjs`. The files carry Google's content credentials (a C2PA tag).
Cues: theme, mission, table, night, breakfast, reveal, guests-win, snakes-win, bell.

## Synthesized
Everything else (the snake hiss, the lute, the fanfares, the chimes, the countdown ticks) is synthesized in the browser
with Web Audio by our own code (`apps/web/src/games/snakes/sound.ts`, `apps/web/src/host/sfx.ts`).
