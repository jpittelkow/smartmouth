# 0006. Games are modules: a manifest, server rules, a TV view and a phone view

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants one game now and "more to choose from in the future". The lobby, joining, reconnects, avatars,
host voice and admin controls are the same for every game and shouldn't be rewritten for each one.

## Decision
A game is a folder in `packages/games/<id>/` with four parts:
- **`manifest.ts`:** the id, name, a one-line pitch, the player count range, the age bands it supports, and whether a Little
  can play (ADR 0009).
- **`server.ts`:** a pure state machine made of `init(players, settings, content)`, `intent(state, playerId, intent, now)`,
  `tick(state, now)`, `hostView(state)` and `playerView(state, playerId)`. There are no sockets, timers or I/O inside. The
  platform calls `tick` when a deadline passes and supplies content (questions, voice lines) through arguments.
- **`Host.tsx`** and **`Controller.tsx`:** React views of `hostView` and `playerView`, built from the shared components
  in the design guide.

The platform owns everything around the game: rooms, the lobby, the game picker (built from manifests), pause,
the spice level, the host voice queue, scores across several games in one night, and the admin sheet. A game reaches these
only through the platform's interfaces, never by importing server internals.

## Consequences
- Adding a second game means writing four files, plus its content. Game two will be the first real test of the interface,
  so expect parts of this ADR to be superseded then.
- The server loads game modules at start-up from a fixed list (`packages/games/index.ts`). There are no plugins loaded at
  runtime from outside the repo.

## Alternatives
One game hard-coded into the platform and generalised later: the usual way, followed by the usual rewrite. Runtime plugins:
no third parties are writing games for this.

## Where it lives
`packages/games/`, `packages/protocol/src/game.ts` (the interface), `apps/server/src/games.ts` (the registry).
