# Project state

_Last updated: 2026-11-26 (overnight build)_

## Phase
Milestone 1: **steps 1–5 built and deployed** (ADR 0019). Waiting on the first family playtest and the owner's pick
of Salty's voice. All ADRs except 0021 are **Proposed** (the owner will review them later).

## What exists
- **Live:** https://play.303.social is the LoudMouth container `smartmouth` on port 8470, through the Cloudflare tunnel (route
  made 2026-11-26). Deploy with `bash scripts/deploy.sh`. The settings file is `/mnt/apps/appdata/smartmouth/.env` (ADMIN_PASSWORD,
  OPENROUTER_API_KEY copied from crayon-box-sync "for now", TRUSTED_PROXIES=172.24.0.1). Data lives in
  `/mnt/apps/appdata/smartmouth/data` (SQLite, `media/voice`, `voice/manifest.json` + salt).
- **TV app** (`apps/tv`): installed on the **office Chromecast** (`192.168.1.109`), defaulting to play.303.social.
  Tested there with the real remote keys over adb. Not yet on any other TV.
- **Server** (`apps/server`): rooms, codes, reconnects, admin password, the question library and its API, the game
  runtime (picks per band, timers, records plays), and Salty (`salty.ts`/`voice.ts`: server-picked lines under the spice
  limit, a bleeped caption and clips per cue). 43 tests.
- **Trivia** (`packages/games/trivia`): pure rules. Views are in `apps/web/src/games/trivia/`.
- **Question generator** (2026-11-27): admin > Generate. Type a topic, tick ages; it researches on the web, writes, and a second
  model checks blind; what passes goes live and is voiced automatically (ADR 0011 revision). `generator.ts`, `ai.ts`, `voiceRunner.ts`.
- **Web:** `/host` (lobby, game, Salty's caption strip with audio and a talking grin, the Back menu), `/play` (join, blob, game
  controller, kid mode during a Little's turn), `/admin` (password, library, editor, coverage, export/import).
- **Content:** 103 seed questions (`content/seed/questions.json`, all live; Little ones show word cards), about 130 Salty
  lines (`content/voice/lines.json`).
- **Voice:** two room voices since 2026-11-27, chosen by a grown-up on the phone (`admin:voice`): male = ElevenLabs
  `harry`, female = `jessica` (owner's picks). Delivery follows spice: Mild and Little moments Nice (`[warmly]`), the rest Snarky
  (`[sarcastic]`); grown-up questions get both readings. Each voice has `voice/manifest-<male|female>.json`.
  Round-2 audition: /media/voice/audition-elevenlabs/index.html. Round 1: five-style audition at https://play.303.social/media/voice/audition/index.html (8 voices). The provisional bank
  voice is `google/gemini-2.5-pro-tts:Algenib` (385 clips). Tool: `tools/voice/voice.mjs`.
- **Code hosting:** public GitHub `jpittelkow/smartmouth` (ADR 0021), MIT.

## Next
0. **Game #2 is decided (owner, 2026-11-27): a hidden-traitor game inspired by the TV show "The Traitors"**
   (secret traitors among the players, round-table votes to banish, night "murders"). **Design drafted 2026-11-27** as a
   Claude Doc, "Smart Mouth: Traitors Mode Design" (https://claude.ai/artifact/2vHrDkftuZKsf1YBcc5QHg): working name
   Snake Manor, roles Guests/Snakes/Ghosts, 5-10 players, trivia missions with Dagger-paying sabotage, identical night
   screens, Salty as "Lord of the Manor". Not reviewed by the owner; no ADR or code yet. Its open questions are at the doc's end.
   Medieval-look mockups: `docs/design/mockups/snake-manor.html` (artifact https://claude.ai/artifact/UR6VZ46KUoY3fcriACf42k), draft 1, with a
   playable banishment reveal (synced sound and visuals); the doc's "Drama" section holds the sound and pacing rules.
1. The owner picks Salty's voice; rerun `bank` with that `VOICE` if it changes.
2. The first family playtest on the office TV, with sound.
3. Back actually pauses; the kid-mode lock; more tracking (results by age band, which wrong answer people pick, the average answer time
   fix); images (on the question itself, uploads, AI-made Little pictures); 
