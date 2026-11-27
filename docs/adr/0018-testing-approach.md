# 0018. Testing: pure game rules under node:test, a socket test per flow, browsers with Playwright

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Most bugs in party games come from timing, reconnects and fairness, and those are hard to see by playing. Real
TVs and phones are slow to test on.

## Decision
- **Game rules and rooms** (pure functions, ADR 0004/0006) are tested with `node:test`, using a fake clock. The rules that
  must hold get their own tests: views never leak the correct answer before the reveal, late answers are refused, the
  spice cap follows the youngest player, and a reconnect keeps the seat and score.
- **One socket test per flow** starts the real server on a random port and drives the host and players with `ws`
  clients (create, join, reconnect, kick, start).
- **Browser tests** (Playwright, later in milestone 1): one host page and three player pages in one browser, a phone
  viewport for players, and remote keys sent to the host page.
- **`npm run check`** runs typecheck, server tests and the web build. It must pass before a commit.
- Tests never call OpenRouter. AI calls go through one module with a fake used in tests.
- Nothing is claimed to work on a TV until it has run on one. The journal says so plainly.

## Consequences
- Fast feedback on the parts that break most. Visual and feel issues still need playtests, which the journal records.

## Alternatives
Testing mainly in browsers: slow and flaky for timing logic.

## Where it lives
`apps/server/test/`, `apps/web/tests/` (later), root `package.json` scripts.
