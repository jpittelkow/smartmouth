# Project state

_Last updated: 2026-11-26_

## Phase
Milestone 1, **build step 1 done**. Step 2 (Trivia v1) is next (ADR 0019). All ADRs (0001–0020) are **Proposed**,
waiting on the owner.

## What exists
- **Docs:** 20 ADRs, the design guide (brand, Salty, spice levels, visual system, UX rules), and 16 mockup artboards
  (`docs/design/mockups/index.html`, also published as a private artifact, linked in the journal).
- **Server** (`apps/server`): rooms in memory, 4-letter codes, join/resume with tokens, admin = first grown-up,
  kick, the spice cap from the youngest band, an origin check, rate limits, an idle-room sweep, and the built web app served from
  `/`. 10 tests (rules + real sockets). No database, AI or voice code yet.
- **Web** (`apps/web`): `/host` TV lobby (code, QR, players, spice chip, game picker with D-pad focus, a caption
  strip with placeholder text lines), `/play` (join with age pictures, blob picker, waiting screen, grown-up spice
  controls, leave), and `/admin` (placeholder).
- **TV app** (`apps/tv`): a Kotlin WebView shell. The debug APK builds (`app.smartmouth.tv`) with 4 unit tests. **Never run on a
  device or emulator yet.**
- **Voice tooling** (`tools/voice`): audition lines plus a generator through OpenRouter speech. Never run (no key used yet).
- **Deploy:** `Dockerfile`, `deploy/`, `scripts/deploy.sh` for the home server on port 8470. **The Docker build has not
  been tried yet, and nothing is deployed.**
- **Hosting:** the Cloudflare route `play.303.social` → `http://192.168.1.4:8470` was set up on 2026-11-26 by another
  session. It returns 502 until the container runs. **Cloudflare Access for `/admin` is not set up.**

## Next
1. The owner reviews the ADRs, the design guide and the mockups, and answers the [open questions](open-questions.md).
2. Build step 2: the trivia rules (everyone-answers and turn rounds), the SQLite bank, about 100 seed questions across the bands,
   handicapped scoring, and the TV and phone game screens from the mockups.
3. First deploy, plus a Playwright test in the repo (the 2026-11-26 browser check lived in a scratch script).
