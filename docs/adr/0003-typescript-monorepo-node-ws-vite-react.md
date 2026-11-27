# 0003. Stack: one TypeScript monorepo, Node 24 + ws on the server, Vite + React on the web

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Three programs speak one live protocol: the server, the TV host screen and the phone controller. Each game has
logic on both sides (server rules, TV view, phone view). The owner's other servers are Python (FastAPI), and Crayon
Box's family server is Node 24 with no build step.

## Decision
- **TypeScript everywhere**, in one npm-workspaces repo:
  `apps/server`, `apps/web`, `apps/tv` (Kotlin, ADR 0007), `packages/protocol` and `packages/games/<game>`.
- **Server:** Node 24, run straight from `.ts` with Node's built-in type stripping (no build step, as in Crayon Box).
  It uses `node:http` for HTTP, **`ws`** for WebSockets (the one runtime dependency, because Node has a WebSocket client but no
  server), `node:sqlite` for storage (ADR 0010) and `node:test` for tests.
- **Web:** Vite + React + TypeScript, one app with the routes `/host` (TV), `/play` (phones) and `/admin`. It's built to
  static files that the server serves in production. In development, Vite's dev server passes `/ws` and `/api` through to Node.
- **Shared types** live in `packages/protocol`. Every message the server sends or accepts is a type there, so a
  protocol change that breaks a client shows up as a type error.
- Server-side TypeScript must stay within what type stripping accepts: no `enum`, no `namespace`, no parameter
  properties, and imports end in `.ts`. Running `tsc --noEmit` with `erasableSyntaxOnly` checks this.

## Consequences
- One language covers the protocol and the games, so a game module can share helpers between its server and its views.
- It's a different stack from the Python projects, so their helpers (Plex, Home Assistant) can't be reused directly here.
- React adds a build step, but only for the web app. The server still has none.

## Alternatives
- **Python FastAPI + plain JS** (as in WhatsOn and colors): no shared types across three clients of one protocol.
- **Colyseus / Socket.IO:** more machinery than a room of ten players needs. The room logic is small and worth owning.
- **Plain TS with no framework on the web:** fine for one screen, but the TV and the phone each have many game states.
  React's state-to-view model fits "show whatever the server says" (ADR 0004).

## Where it lives
`package.json` (workspaces), `tsconfig.base.json`, `apps/server`, `apps/web`, `packages/protocol`.
