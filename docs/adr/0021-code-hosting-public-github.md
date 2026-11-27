# 0021. Code hosting: public GitHub, MIT license

- **Status:** Accepted (owner, 2026-11-26: "github public")
- **Date:** 2026-11-26

## Context
The repo started with no remote. The owner's other kids' apps (colors, Crayon Box) are public on GitHub.

## Decision
- The code lives in a **public GitHub repo**, `jpittelkow/smartmouth`. `main` is the branch.
- The license is **MIT**, the same as Crayon Box.
- Because it's public, the [CLAUDE.md](../../CLAUDE.md) privacy rule matters more: nothing identifying the family's kids, and no secrets.
  Before the first push, the owner's leak checker (`~/claude-memory/leak_check.py`) is run over the tree.
- Home-network details that are already in the deploy files (the server's LAN address and port) stay. They're private-range
  addresses with no credentials. Any key, password or token is in `.env` on the server only.

## Consequences
- Anyone can read the prompts, Salty's lines and the design. Salty's line bank and question seeds are effectively public.
- Content made by AI and kept in the database (questions, voice files) isn't in the repo, so it doesn't become public by accident.

## Alternatives
Private GitHub or Gitea only: the owner chose public.

## Where it lives
GitHub, plus `LICENSE` and `package.json` (`license`).
