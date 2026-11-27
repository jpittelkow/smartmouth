# Architecture Decision Records

Each file records one decision for Smartmouth: the context, what we chose, and what it costs.
Status values: Proposed, Accepted, Deferred (agreed but not being built yet), Rejected, Superseded.
A Proposed ADR may still be edited. An Accepted one changes only through a new ADR that supersedes it (ADR 0001).
New ADRs start from [template.md](template.md).

**Before you change an area, read its ADRs.** A change that makes or reverses a design decision comes with an ADR in
the same commit.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-record-decisions-as-adrs.md) | Record decisions as ADRs | Proposed |
| [0002](0002-scope-a-living-room-party-game.md) | Scope: a living-room party game, TV first, phones join on the web | Proposed |
| [0003](0003-typescript-monorepo-node-ws-vite-react.md) | Stack: TypeScript monorepo, Node 24 + ws, Vite + React | Proposed |
| [0004](0004-the-server-owns-the-game.md) | The server owns the game; the TV and phones only show it | Proposed |
| [0005](0005-rooms-codes-joining-and-reconnects.md) | Rooms, room codes, joining and reconnects; no accounts | Proposed |
| [0006](0006-games-are-modules.md) | Games are modules: manifest, server rules, TV view, phone view | Proposed |
| [0007](0007-the-tv-app-is-a-thin-webview-shell.md) | The Android TV app is a thin WebView shell | Proposed |
| [0008](0008-age-bands-per-player.md) | Age bands belong to each player; scoring is fair across them | Proposed |
| [0009](0009-the-little-seat.md) | The Little seat: pictures, read aloud, no timer, TV remote | Proposed |
| [0010](0010-question-bank-in-sqlite.md) | The question library: SQLite, graded on several axes, managed in /admin | Proposed |
| [0011](0011-ai-content-through-openrouter-reviewed.md) | AI writes content ahead of time via OpenRouter; a grown-up reviews | Proposed |
| [0012](0012-current-events-questions.md) | Current-events questions from chosen feeds, with expiry | Proposed |
| [0013](0013-host-voice-openrouter-tts-as-files.md) | The host's voice: OpenRouter speech, made ahead, played from files | Proposed |
| [0014](0014-host-persona-and-spice-levels.md) | The host persona and spice levels | Proposed |
| [0015](0015-hosting-one-container-cloudflare-tunnel.md) | Hosting: one container, Cloudflare Tunnel, our own admin password | Proposed |
| [0016](0016-privacy-and-names.md) | Privacy: names stay in the room; Salty may say them | Proposed |
| [0017](0017-design-language.md) | Design language: a late-night cartoon game show | Proposed |
| [0018](0018-testing-approach.md) | Testing approach | Proposed |
| [0019](0019-build-order.md) | Build order | Proposed |
| [0020](0020-working-name-smartmouth.md) | Working name: Smartmouth, hosted by Salty | Proposed |
| [0021](0021-code-hosting-public-github.md) | Code hosting: public GitHub, MIT license | Accepted |
| [0022](0022-game-two-snake-manor.md) | Game #2 is Snake Manor, a hidden-traitor game on trivia missions | Proposed |
| [0023](0023-hidden-information.md) | Hidden information: secrets on one phone, every phone looks the same | Proposed |
| [0024](0024-drama-sequences.md) | Drama sequences: timed reveals, paired sound and picture, Full or Quick | Proposed |
| [0025](0025-briefings-explain-before-you-play.md) | Briefings: Salty explains each new thing on a rules card first | Proposed |
