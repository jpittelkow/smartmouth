# 0020. Working name: Smartmouth, hosted by Salty

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner is open to naming ideas and will supply a domain later (2026-11-26). Code, packages and the TV app need
a name now, and renaming later is cheap if one place holds it (Crayon Box was renamed from `kidsapp` mid-project).

## Decision
- **Smartmouth** is the working product name. It's smart (trivia) plus mouthy (the host), and it reads well as
  `play.smartmouth.<tld>` or `smartmouth.<tld>`.
- **Salty** is the host's working name.
- The name lives in one place in each app: `packages/protocol/src/brand.ts` (web and server) and the `app_name` string
  resource (TV), so a rename only touches those, the docs and the package names.
- **Other candidates for the owner:** *Peanut Gallery*, *Heckle*, *Couch Mutiny*, *Know-It-Owl*, *Smart Alec*,
  *Trivia Mutiny*, *Wise Crack*. Before any of them is final: check the domain, check app-store and trademark search
  results for game-name conflicts, and check that no well-known game uses it.

## Consequences
- The folder, packages and APK id use `smartmouth` until the owner decides.

## Alternatives
Wait for a name before scaffolding: blocks work for a cheap-to-change decision.

## Where it lives
`packages/protocol/src/brand.ts`, `apps/tv/app/src/main/res/values/strings.xml`, [open-questions.md](../memory/open-questions.md).
