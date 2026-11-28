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

## Generated sound effects (Snake Manor)
Generated on our own GPU with **Stable Audio Open 1.0** (`stabilityai/stable-audio-open-1.0`) on 2026-11-27, from
the prompts in `tools/sounds/sfx-cues.json` (each says what the sound is for), and picked by ear on the audition
page. Files: `media/sounds/game/<cue>.g1.mp3` for envelope, unfold, letter, dagger, shield, cards, whoosh, knock,
gasp, fanfare, misfanfare, chime, birds, tick and lute, plus `hiss.g1.mp3` (the king cobra prompt in
`tools/sounds/sfx-hiss.json`, take 2). Powered by Stability AI, under the Stability AI Community
License (https://stability.ai/community-license-agreement).

## Drunk Salty's drinking sounds
The mouth noises (sip, hiccup, sloppy hiccups, three gulps, two slurps) are Salty's own voice, made with the same
speech model as her lines (`google/gemini-3.8-flash-tts`, voice Laomedeia) through OpenRouter on 2026-11-27, from
`tools/voice/audition-drunk.mjs`. The glass and bottle sounds (clink, toast, pour, slam, roll) were generated on our
own GPU with **Stable Audio Open 1.0** on 2026-11-27, from the prompts in `tools/sounds/sfx-drunk.json`. Powered by
Stability AI, under the Stability AI Community License (https://stability.ai/community-license-agreement). All
picked by ear by the owner; files are `media/sounds/drunk/<sound>-<n>.20261127.mp3` (map in `apps/server/src/drunk.ts`).

## Music and the bell (Snake Manor)
Generated with **Google Lyria 3** (`google/lyria-3-clip-preview`) through OpenRouter on 2026-11-27, from our own
prompts in `tools/sounds/sounds.mjs`. The files carry Google's content credentials (a C2PA tag).
Cues: theme, mission, table, night, breakfast, reveal, guests-win, snakes-win, bell.

## Sound effects (Trivia)
All from [Freesound](https://freesound.org), released under **CC0 1.0** (no credit required; we credit them anyway).
Picked by the owner on 2026-11-27 from the audition (`tools/sounds/trivia/`); moments with several files rotate.
Trimmed and levelled with ffmpeg (design guide 4.1).

| Cue | Sound | Author | Used for |
|---|---|---|---|
| trivia-start | [Notification](https://freesound.org/people/Fupicat/sounds/538149/) | Fupicat | Game starts |
| trivia-round | [Deep Whoosh #5](https://freesound.org/people/Kinoton/sounds/558827/) | Kinoton | Round change (transition) |
| trivia-lock | [UI Button Click](https://freesound.org/people/benzix2/sounds/467951/) | benzix2 | Someone locks in an answer |
| trivia-tick | [single-tick.wav](https://freesound.org/people/DeltaCode/sounds/668355/) | DeltaCode | Countdown tick (last 5 seconds) |
| trivia-reveal | [buzz roll.wav](https://freesound.org/people/bigjoedrummer/sounds/77305/) | bigjoedrummer | Answer reveal |
| trivia-right | [Correct Bell](https://freesound.org/people/Fupicat/sounds/538147/) | Fupicat | Correct answer |
| trivia-allwrong | [horn_fail_wahwah_1.wav](https://freesound.org/people/TaranP/sounds/362206/) | TaranP | Nobody got it |
| trivia-applause | [Small Crowd Applause 1](https://freesound.org/people/snakebarney/sounds/138113/) | snakebarney | Everyone got it |
| trivia-slide | [whoosh_short_mid.wav](https://freesound.org/people/DJT4NN3R/sounds/449996/) | DJT4NN3R | Leaderboard rows slide |
| trivia-sparkle | [Sparkle Burst](https://freesound.org/people/Qvantor/sounds/880771/) | Qvantor | A Little's turn starts |
| trivia-join-1 | [Simple Pop Sound Effect](https://freesound.org/people/SplendidJams/sounds/570459/) | SplendidJams | Player joins (rotates) |
| trivia-join-2 | [Pop up!](https://freesound.org/people/Losh.id/sounds/791346/) | Losh.id | Player joins (rotates) |
| trivia-join-3 | [TOONY pops.wav](https://freesound.org/people/mikala_oidua/sounds/321163/) | mikala_oidua | Player joins (rotates) |
| trivia-timeup-1 | [Loud Buzzer.mp3](https://freesound.org/people/SomeoneCool15/sounds/419086/) | SomeoneCool15 | Time's up (rotates) |
| trivia-timeup-2 | [buzzer_feeback.aif](https://freesound.org/people/scarfield/sounds/52002/) | scarfield | Time's up (rotates) |
| trivia-timeup-3 | [buzzer sportif.wav](https://freesound.org/people/Naïma/sounds/510026/) | Naïma | Time's up (rotates) |
| trivia-count-1 | [Retro, Coin 03.wav](https://freesound.org/people/LilMati/sounds/402767/) | LilMati | Scores count up (rotates) |
| trivia-count-2 | [Retro, Coin 06.wav](https://freesound.org/people/LilMati/sounds/515736/) | LilMati | Scores count up (rotates) |
| trivia-count-3 | [Retro, Coin 01.wav](https://freesound.org/people/LilMati/sounds/402067/) | LilMati | Scores count up (rotates) |
| trivia-yay-1 | [Party horn.wav](https://freesound.org/people/audiosmedia/sounds/170583/) | audiosmedia | A Little gets it right (rotates) |
| trivia-yay-2 | [Fail Jingle Party Horn](https://freesound.org/people/qubodup/sounds/825292/) | qubodup | A Little gets it right (rotates) |

## Music (Trivia)
Generated with **Google Lyria 3** (`google/lyria-3-clip-preview`) through OpenRouter on 2026-11-27, from our own
prompts in `tools/sounds/trivia/music.mjs`; two takes of each, rotating. Cues: trivia-lobby, trivia-think,
trivia-leaderboard, trivia-winner.

## The drum roll (Trivia)
Generated with **ByteDance Seed Audio 1.0** (`bytedance-seed/seed-audio-1-0`) through OpenRouter on 2026-11-27, from our
own prompts in `tools/sounds/trivia/rollcrash.mjs`: a snare roll building into a crash, four takes that rotate
(trivia-rollcrash-1 to 4). Each is trimmed so its crash lands as the answer appears (2.2 s). OpenRouter has no dedicated
sound-effects model; ElevenLabs' voice models there refuse tag-only input.

## Synthesized
Fallbacks for any sound whose file is missing, and Trivia's small interface sounds, are synthesized in the browser
with Web Audio by our own code (`apps/web/src/games/snakes/sound.ts`, `apps/web/src/host/sfx.ts`).
