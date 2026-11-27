# 0007. The Android TV app is a thin WebView shell

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The host screen is a web page (ADR 0003). The owner's GlanceTV already runs a web page full-screen on the office
Chromecast with a small Kotlin shell, and colors has a full native TV app. A native host screen would duplicate
the web host screen for no gain.

## Decision
- `apps/tv` is a Kotlin app adapted from GlanceTV's shell: one activity with a full-screen WebView on `<server>/host?tv=1`.
- The shell does only what a page can't: a Leanback launcher entry, keeping the screen on, immersive mode, playing audio
  without a tap (Salty has to talk on his own), a native retry screen with backoff when the server is down, a
  settings screen for the server URL, and handing Back to the page first (`window.smartmouthBack()`) before asking to
  quit.
- **The remote is a game controller.** The D-pad and OK reach the page as ordinary key events, and the web host screen
  handles them (menus, the Little seat in ADR 0009). No JS bridge is needed for keys.
- A small JS interface, `SmartmouthTV`, tells the page that it's on a TV and which app version it is.
- The APK changes rarely. Game changes ship by deploying the server.

## Consequences
- There's one host screen to build and test, and it runs in a desktop browser.
- WebView performance on cheap TV sticks limits animation, so the design guide keeps motion modest (§5.5).
- Updating the APK is a manual `adb install` until there's a reason for more.

## Alternatives
A native Compose host screen (as in colors): two host screens to keep in step. Chrome on the TV, or casting a tab: no
audio autoplay, no remote key handling and no launcher icon.

## Where it lives
`apps/tv/` (see its README).
