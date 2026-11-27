# 0002. Scope: a living-room party game, TV first, phones join on the web

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants a trivia party game in the style of the well-known couch party games. The TV shows the game, and
everyone joins on their phone by opening a web page, with no app to install. There's one game first, with room for more later. Players
range from 3–4 years old to adults, often in the same room.

## Decision
- **One shared screen, many phones.** The TV runs the host screen, and each player uses a browser on any phone or tablet.
  Players install nothing.
- **Android TV is the first TV**, through a thin app (ADR 0007). Because the host screen is a web page, any browser on a
  laptop or a cast tab also works, and that's how it's developed and tested.
- **The family's own server hosts it** on a public domain the owner provides (`play.<domain>`, ADR 0015), so
  friends' phones on cellular can join.
- **Several games, one platform.** Trivia is game one. The lobby, joining and the game picker are shared (ADR 0006).
- **Mixed ages in one room** is a first-class case, not an afterthought (ADR 0008, 0009).
- **Out of scope for now:** remote play across houses (streaming the TV screen), accounts, leaderboards that last
  between sessions, a store or payments, and native iOS/tvOS apps.

## Consequences
- Joining is fast (scan, type a name, done), but it depends on the phones' browsers and the internet link.
- The server must be reachable from outside the house, which brings in ADR 0015's hosting and ADR 0016's privacy work.

## Alternatives
Native phone apps: having to install something kills a party game. Local network only: friends on cellular couldn't join, and
TVs on networks that isolate clients would break it.

## Where it lives
The whole repo. `README.md` states the scope.
