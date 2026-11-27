# 0005. Rooms, room codes, joining and reconnects; no accounts

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Joining has to take seconds, from any phone, with nothing to install or sign up for. Phones reconnect a lot.

## Decision
- **The TV makes a room.** Opening `/host` asks the server for a room and gets back a **host token** and a **4-letter code**. The code uses an alphabet
  with no easily confused letters and no vowels, so codes can't spell words.
- **Players join with the code**, a name (1–16 characters, trimmed), an age band (ADR 0008) and an avatar.
  Each gets a **seat token**, kept in that phone's `localStorage` per room code.
- **Reconnecting means showing the token.** A socket that presents a valid host or seat token takes over that role and seat,
  and the old socket for it is closed. The TV shows a seat as "away" while it has no socket, and a player keeps their
  score while away.
- **Limits:** 10 players per room (one row of tiles on the TV). More could join as **audience** later, but not in milestone 1.
  A room with no host socket and no connected players for 15 minutes is deleted, along with everything in it.
- **The first player who picks "Grown-up" is the room admin**, with skip, pause, spice level, kick and end game. The host
  screen (the TV remote) has the same powers. If the admin leaves, the role moves to the next grown-up.
- **No accounts and no logins** for players. The admin page is separate and has its own password (ADR 0015).
- The QR code on the TV opens `play.<domain>/play?code=WXYZ`, so scanning fills in the code.

## Consequences
- Anyone with the code can join while the room is open, and the admin can kick them. That's fine for a living room.
- Rooms exist only in memory, so nothing about a game outlives it (ADR 0016), and a server restart ends them.

## Alternatives
Accounts or magic links: friction a party game can't afford. 6-digit number codes: harder to read off a TV across a room than 4 letters.

## Where it lives
`apps/server/src/rooms.ts`, `apps/server/src/codes.ts`, `apps/web/src/play/`.
