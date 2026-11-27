# 0004. The server owns the game; the TV and phones only show it

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Phones lock, drop off Wi-Fi and reload, and the TV app restarts. Party games fall apart when state lives in a client.
Answers also have to be fair: a phone mustn't learn the right answer before the reveal.

## Decision
- **Each room's state lives only on the server**, in memory. Clients send **intents** (`join`, `answer`, `start`,
  `next`) and receive **views**.
- **Views are per role.** After every change the server builds one view for the host and one for each player, and sends
  each client only its own. A player's view never carries the correct answer before the reveal, or other players' picks.
- **Full views, not patches**, at this size (10 players or fewer, a few KB each). A client that reconnects gets the current view
  and is up to date, with no event replay to get wrong.
- **The server keeps the clock.** Timers are deadlines on the server. Clients draw a countdown from the `deadline` and
  the server time in each view, and the server, not the phone, refuses a late answer.
- **Game rules are pure functions** that take the state, an intent and the current time and return the new state (ADR 0006).
  That means they can be tested without sockets, and a game can be replayed from a log to chase a bug.

## Consequences
- Reconnects and TV app restarts are cheap and correct.
- A server restart ends any rooms in progress. That's acceptable for a party game, and rooms are not saved (ADR 0005).
- Every state change means sending every view again. That's fine at this scale; revisit only if a game has many players.

## Alternatives
Clients hold the state and the server relays messages: easy to start, impossible to make fair or reconnect-safe. Sending only changes (deltas):
more efficient, more bugs, and not needed at 10 players.

## Where it lives
`apps/server/src/rooms.ts` (rooms and sending views), `packages/protocol` (intents and views), each game's `server.ts`.
