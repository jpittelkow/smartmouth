# CLAUDE.md

Guidance for Claude (and any other AI or human contributor) working in this repo. `AGENTS.md` points here.

## What this is
**Smartmouth** (working name, ADR 0020) is a party trivia game for the living room. The TV shows the game, players join on their
phones at `play.<domain>`, and ages 3 to adult play together. The host, **Salty**, is snarky and voiced by AI, and his lines
are clean or dirty depending on who's in the room. There's one game now, with more planned. Design lives in [docs/adr](docs/adr/README.md),
and the look and voice are in [docs/design/design-guide.md](docs/design/design-guide.md).

## Start of every session
1. Read [docs/memory/README.md](docs/memory/README.md) and the memory files it lists. They're short.
2. Skim the newest entry in [docs/journal](docs/journal/README.md) to see where the last session stopped.
3. Read the ADRs for the area you're about to change.

## End of every session (or after a meaningful chunk of work)
1. Add or update today's journal entry, `docs/journal/YYYY-MM-DD.md` (template in the journal README).
2. Update the memory files whose facts changed. Edit them in place, and delete what's no longer true.
3. A new or changed design decision becomes an ADR (ADR 0001), not just a memory note. An agent's ADR stays
   **Proposed** until the owner accepts it.

## Commands
```bash
npm install
npm run dev          # server on :8470 + Vite on :5173 (open /host in one tab, /play in others)
npm run check        # typecheck + server tests + web build — must pass before a commit
npm test             # server tests only
```
TV app: see [apps/tv/README.md](apps/tv/README.md).

## Layout
| Path | What |
|---|---|
| `apps/server` | Node 24, runs `.ts` directly (type stripping), `ws`, `node:sqlite` |
| `apps/web` | Vite + React: `/host` (TV), `/play` (phones), `/admin` |
| `apps/tv` | Kotlin WebView shell for Android TV |
| `packages/protocol` | shared types: intents, views, bands, spice, brand |
| `packages/games/<id>` | one game: manifest, server rules, Host view, Controller view (ADR 0006) |
| `content/seed` | hand-written seed questions (JSON) |
| `tools/voice` | making and auditioning Salty's voice files (ADR 0013) |

## Rules
- **The server owns the game** (ADR 0004). Clients send intents and show views. Never put the correct answer in a
  player view before the reveal.
- **Server TypeScript must be erasable**: no `enum`, no `namespace`, no parameter properties, and imports end in `.ts`.
- **Spice is a server rule** (ADR 0014). A line or question above the room's level is never picked. Keep the test.
- **Salty is an original character.** Never name, quote or imitate a real actor, comedian or film character in
  prompts, lines or voice settings. No voice cloning.
- **AI content is made ahead of time and reviewed** (ADR 0011). Little and Kids content always needs a grown-up's approval.
  Tests never call OpenRouter.
- **Secrets** (`OPENROUTER_API_KEY`, `ADMIN_TOKEN`, tunnel credentials) never go in the repo. Use `.env`, which is gitignored.
- Dates in docs are absolute (`2026-11-26`), never "yesterday".
- Dev machine is Windows, so commands in docs should work in Git Bash or PowerShell.

## Privacy rule (hard rule, applies to every file in the repo)
**Never write anything that identifies the family's kids**: no names, nicknames, initials, birthdays or ages tied to
a specific child, schools, photos, device or account names. That covers docs, code, comments, tests, sample data, commit messages
and file names. Refer to kids generically ("a kid", "the youngest"). Test players use made-up names ("Blue Blob").
Player names in a running game stay in room memory only (ADR 0016). If you find an identifier already in the repo,
flag it to the owner.
