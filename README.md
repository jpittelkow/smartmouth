# Smartmouth

A living-room party trivia game. The TV hosts and everyone joins on their phone at **play.303.social**, with nothing
to install. Players from 3 years old to adults play in the same game: each picks an age, gets questions their size,
and scores are handicapped so the youngest can win. The host, **Salty**, is a snarky, cowardly ex-captain voiced by AI.
He keeps it clean when kids are in the room and goes filthy on grown-up nights.

_Smartmouth and Salty are working names (ADR 0020)._

- Design decisions: [docs/adr](docs/adr/README.md)
- Look, voice and UX: [docs/design/design-guide.md](docs/design/design-guide.md); mockups in
  [docs/design/mockups/index.html](docs/design/mockups/index.html)
- Project memory and session journal: [docs/memory](docs/memory/README.md), [docs/journal](docs/journal/README.md)
- Rules for contributors and AI tools: [CLAUDE.md](CLAUDE.md)

## How it fits together
```
TV: Android TV shell (apps/tv) ──WebView──▶ /host ┐
Phones: any browser ─────────────────────▶ /play ├─ Node server (apps/server): rooms, live socket /ws,
Grown-ups: ─────────────────────────────▶ /admin ┘   question bank, voice files. One container.
```
The server owns all game state. The TV and phones only show what it sends them (ADR 0004). Games are modules in
`packages/games/` (ADR 0006). Trivia is the first.

## Running it locally
Needs Node 24.
```bash
npm install
npm run dev
```
Open `http://localhost:5173/host` in one tab (the TV), and `http://localhost:5173/play` in others (the phones). To use real
phones on the home Wi-Fi, open `http://<this PC's LAN address>:5173/play`.

`npm run check` runs the typecheck, the server tests and the web build.

## The TV app
[apps/tv/README.md](apps/tv/README.md): build with Gradle and point it at the server.

## Deploying
`scripts/deploy.sh` builds the image on the home server from the committed source and starts it on port **8470**,
which is the port the Cloudflare route for `play.303.social` points at. Settings live in the server's `.env` (see
[.env.example](.env.example)). Secrets never go in the repo.

## Status
Build step 1 (ADR 0019) is done: rooms, joining by code or QR, the lobby on the TV, reconnects, the age-based spice cap
and grown-up controls. Trivia itself is next. See [project-state](docs/memory/project-state.md).
