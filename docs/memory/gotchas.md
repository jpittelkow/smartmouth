# Gotchas

Non-obvious traps, workarounds and lessons learned. One bullet each, with the date found.
_Last updated: 2026-11-26_

## Server / TypeScript
- Node runs the server's `.ts` directly, and that works across npm workspaces because Node resolves the workspace symlink to
  its real path outside `node_modules` (type stripping is off inside `node_modules`). Confirmed 2026-11-26.
- The WebSocket origin check must allow the server's own host (`Origin` host == request `Host`). Without it, a page the
  server itself served was refused whenever `PUBLIC_URL` was unset (found 2026-11-26).
- Cloudflare sends HTTPS on to the app as plain HTTP. Trust `X-Forwarded-Proto` if the app ever builds absolute URLs from the
  request. Today it uses `PUBLIC_URL` instead (2026-11-26).

## Web
- The phone's blob picker must show only right after joining. Showing it on every load sent reconnecting phones back
  to the picker (found 2026-11-26).
- The TV design needs a `--stage` panel: ink outlines and shadows are invisible on the `--ink` background (found
  while drawing the mockups, 2026-11-26; design guide §5.4).

## TV app (from the 2026-11-26 build)
- Gradle on this PC fails with "Unable to establish loopback connection" unless it's run with the sandbox off and
  `JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\tmp\gradle-sock' TEMP='C:\tmp' TMP='C:\tmp'`.
  The command is in `apps/tv/README.md`.
- A `--` inside an XML comment in `AndroidManifest.xml` is invalid XML, and it fails the build with a vague MergeFailureException.
- The TV banner spells the name as vector paths (vector drawables can't hold text), so it needs redrawing on a rename.
- A WebView `<video>` with no poster shows a grey play button unless `getDefaultVideoPoster` is overridden. That's already done.

## Deploy and server (2026-11-26)
- This Windows checkout holds CRLF copies of some files, which bash on the server rejects (`pipefail: invalid option`).
  `deploy.sh` reads the stack files with `git show HEAD:...`, which are always LF.
- The tunnel's traffic reaches the container from `172.24.0.1` (the gateway of the `smartmouth_default` network). If that
  network is ever recreated with another subnet, update `TRUSTED_PROXIES` in the server `.env`.
- Editing `/mnt/apps/appdata/smartmouth/.env` needs the container **recreated** (`docker compose -p smartmouth up -d
  --force-recreate` in the Compose Manager project folder, or a deploy); `docker restart` keeps the old values. Docker
  strips quotes around values, so a quoted password is the text inside them (2026-11-27).
- Restarting the container (a deploy) kills any `docker exec` voice run inside it. Don't deploy while `voice.mjs` is running.
- Test games played against the live server count in the question stats. Wipe them after testing (journal 2026-11-26 has the
  one-liner).

## Voice (2026-11-26)
- `content/voice/lines.json` holds every game's lines (trivia's plain moments, Snake Manor's `sm-*`). A rewrite must replace
  only its own game's moments and keep the rest: a trivia rewrite on 2026-11-27 dropped Snake Manor's 98 lines (restored from
  `289dedc`). The `snakes-platform` test catches it.
- OpenRouter lists speech models at `/api/v1/audio/speech/models/<id>`, not in `/api/v1/models`. `openai/gpt-4o-mini-tts` isn't
  there.
- Gemini TTS returns only wav or pcm (about 48 KB a second). ElevenLabs stock voices retire on 2026-12-31. Fish Audio S2.1 Pro works with no
  voice given and takes `instructions`.
- One request at a time: the shared key's in-flight budget gives 402s for parallel calls (found by Crayon Box).
- Lyria 3 music on OpenRouter returns audio only with `"modalities": ["text", "audio"]` and `"stream": true` (base64 mp3 in
  `choices[0].delta.audio.data`). Without them it still charges $0.04 and returns just `<instrumental>` (2026-11-27, `tools/sounds/README.md`).
- Cloudflare keeps `/media` files for a year, response headers included. After a header change, old copies still carry
  the old headers (a cached CORP header stopped the sound audition playing, 2026-11-27): link to `?v=<stamp>` or purge.

## Office Chromecast
- GlanceTV's screensaver stays over a newly launched app until a key wakes the device (`input keyevent KEYCODE_WAKEUP`).

## Tooling
- Playwright isn't installed in this repo yet. The 2026-11-26 browser check borrowed it from `code/kidsapp/node_modules`
  with `NODE_PATH`.
- Writing many files with bash heredocs failed in this environment ("unexpected EOF"). Use the file tools instead.
