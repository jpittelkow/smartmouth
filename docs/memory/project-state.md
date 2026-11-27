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
- **Web:** `/host` (lobby, game, Salty's caption strip with audio and a talking grin, the Back menu), `/play` (join, blob, game
  controller, kid mode during a Little's turn), `/admin` (password, library, editor, coverage, export/import).
- **Content:** 103 seed questions (`content/seed/questions.json`, all live; Little ones show word cards), about 130 Salty
  lines (`content/voice/lines.json`).
- **Voice:** five-style audition at https://play.303.social/media/voice/audition/index.html (8 voices). The provisional bank
  voice is `google/gemini-2.5-pro-tts:Algenib` (385 clips). Tool: `tools/voice/voice.mjs`.
- **Code hosting:** public GitHub `jpittelkow/smartmouth` (ADR 0021), MIT.

## Next
1. The owner picks Salty's voice; rerun `bank` with that `VOICE` if it changes.
2. The first family playtest on the office TV, with sound.
3. Back actually pauses; the kid-mode lock; more tracking (results by age band, which wrong answer people pick, the average answer time
   fix); images (on the question itself, uploads, AI-made Little pictures); AI question generation (ADR 0011).
