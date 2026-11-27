# Project state

_Last updated: 2026-11-26 (evening)_

## Phase
Milestone 1, **build step 2 (Trivia v1) built** on 2026-11-26: playable end to end in a browser. All ADRs except 0021 are
**Proposed**, waiting on the owner. Next: more seed questions (to about 100), then steps 3–5 (a real TV, Salty's voice, deploy).

## What exists
- **Docs:** 20 ADRs, the design guide (brand, Salty, spice levels, visual system, UX rules), and 16 mockup artboards
  (`docs/design/mockups/index.html`, also published as a private artifact, linked in the journal).
- **Server** (`apps/server`): rooms in memory, 4-letter codes, join/resume with tokens, admin = first grown-up,
  kick, the spice cap from the youngest band, an origin check, rate limits, an idle-room sweep, and the built web app served from
  `/`, the admin password, the question library API, and the game runtime (picks questions per band, timers, records
  plays). 37 tests. No AI or voice code yet.
- **Trivia** (`packages/games/trivia`): pure rules. 8 rounds; everyone answers a question sized to their band; Little
  turns every other round (TV remote or kid-mode phone, no timer, helper bonus); handicapped scoring; final with
  superstars. Views: `apps/web/src/games/trivia/`. Salty's lines are text captions only (placeholders in `lines.ts`).
- **Web** (`apps/web`): `/host` TV lobby (code, QR, players, spice chip, game picker with D-pad focus, a caption
  strip with placeholder text lines), `/play` (join with age pictures, blob picker, waiting screen, grown-up spice
  controls, leave), and `/admin`: password sign-in, then the **question library** (search, filters for every grade, editor,
  bulk status, coverage grids, JSON export/import). See ADR 0010.
- **Question library:** SQLite (`DATA_DIR/smartmouth.db`), 39 seed questions in `content/seed/questions.json`, all live; the 8
  Little picture questions are live and shown as **word cards** until pictures exist (ADR 0009).
- **Code hosting:** public GitHub (ADR 0021), MIT license.
- **TV app** (`apps/tv`): a Kotlin WebView shell. The debug APK builds (`app.smartmouth.tv`) with 4 unit tests. **Never run on a
  device or emulator yet.**
- **Voice tooling** (`tools/voice`): audition lines plus a generator through OpenRouter speech. Never run (no key used yet).
- **Deploy:** `Dockerfile`, `deploy/`, `scripts/deploy.sh` for the home server on port 8470. **The Docker build has not
  been tried yet, and nothing is deployed.**
- **Hosting:** the Cloudflare route `play.303.social` → `http://192.168.1.4:8470` was set up on 2026-11-26 by another
  session. It returns 502 until the container runs. `/admin` has its own password (`ADMIN_PASSWORD`, ADR 0015).

## Next
1. The owner reviews the ADRs, the design guide and the mockups, and answers the [open questions](open-questions.md).
2. Build step 2: the trivia rules (everyone-answers and turn rounds), the SQLite bank, about 100 seed questions across the bands,
   handicapped scoring, and the TV and phone game screens from the mockups.
3. First deploy, plus a Playwright test in the repo (the 2026-11-26 browser check lived in a scratch script).
