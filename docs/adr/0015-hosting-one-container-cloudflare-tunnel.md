# 0015. Hosting: one container on the home server, public through a Cloudflare Tunnel

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Phones on cellular must reach the game, and the owner will supply a domain (`play.<domain>`). The owner's other
apps run as single containers on the home Unraid server, deployed with `scripts/deploy.sh`, and they already use
Cloudflare for DNS.

## Decision
- **One Docker container** runs the Node server, which serves the built web app, the WebSocket at `/ws`, the API at
  `/api`, and the media (voice, images) at `/media`. The data folder (SQLite, media) is one mounted volume.
  Default port `8470` (unused by the owner's other apps on 2026-11-26; check before deploying).
- **Public through a Cloudflare Tunnel** (`cloudflared`): no port forwarding, TLS at Cloudflare, and WebSockets work.
  `play.<domain>` serves `/`, `/play` and `/host`.
- **`/admin` and `/api/admin/*` are behind our own password**, not Cloudflare Access (the owner's choice, 2026-11-26).
  It's one shared password, set as `ADMIN_PASSWORD` in the server's `.env` (the deploy generates a random one the first time).
  Signing in sets a random session token in an `HttpOnly`, `SameSite=Strict` cookie, which is `Secure` behind HTTPS and lasts 30 days.
  Sessions are held in memory, so a restart signs everyone out. Five wrong tries per address lock that address out for 15 minutes, and
  the comparison takes the same time whatever the guess. Every admin API route checks the session on the server. Without
  `ADMIN_PASSWORD`, the admin area stays locked.
- **Abuse limits:** the server rate-limits room creation and join attempts per IP, caps messages per socket, and
  checks the WebSocket `Origin` against `PUBLIC_ORIGIN`.
- **On the LAN**, the TV can use the server's LAN address directly (the setting in ADR 0007), which avoids
  a round trip through Cloudflare. Phones can use either.
- **`scripts/deploy.sh`** builds the image and recreates the container, like the owner's other apps.

## Consequences
- The game is reachable from anywhere, so the rate limits and admin protection aren't optional.
- If the house internet is down, phones on cellular can't play, but phones on home Wi-Fi with the LAN address still can.

## Alternatives
Cloudflare Access in front of `/admin`: stronger, but it's one more service to set up and sign into, and the owner
prefers a password the app owns. Port forwarding: exposes the server directly and needs certificate handling. A cloud host (Fly, Render): another bill, and
the media and data would live away from home backups.

## Where it lives
`Dockerfile`, `deploy/`, `scripts/deploy.sh`, `apps/server/src/http.ts` (limits, origin check, admin routes),
`apps/server/src/admin.ts` (the password and sessions), `apps/web/src/admin/Admin.tsx`.
