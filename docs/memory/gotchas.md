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

## Tooling
- Playwright isn't installed in this repo yet. The 2026-11-26 browser check borrowed it from `code/kidsapp/node_modules`
  with `NODE_PATH`.
- Writing many files with bash heredocs failed in this environment ("unexpected EOF"). Use the file tools instead.
