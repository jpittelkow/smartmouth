# 0017. Design language: a late-night cartoon game show

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Two very different screens (a TV across the room, a phone in one hand) and players from 3 to adult need one
look. More games will reuse it. The owner asked for a UI/UX and branding guide, plus mockups (2026-11-26).

## Decision
Adopt [docs/design/design-guide.md](../design/design-guide.md) as the design language. Its main points:
- A **dark stage** always on the TV and phones, with a spotlight yellow for the main action. Light mode exists only on `/admin`.
- **Flat, chunky cartoon game-show components**: ink outlines and hard offset shadows on anything you can press.
- **Answer slots carry colour and shape** (star, heart, moon, bolt), so colour is never the only signal. The look is deliberately
  unlike other party games' answer grids.
- **Type:** Bricolage Grotesque for display, Atkinson Hyperlegible Next for everything you read, self-hosted.
- **The TV shows, the phone acts.** The question lives on the TV, and the phone shows only what you tap.
- **Ten-foot rules** on the TV (32 px minimum, D-pad focus rings) and toddler rules for the Little seat (ADR 0009).
- The tokens in the guide are the CSS custom property names in `apps/web/src/styles/tokens.css`.

The mockups in [docs/design/mockups/](../design/mockups/index.html) are drawn from the guide. Where they made a
choice the guide didn't, the mockup page lists it for the owner to accept or reject.

## Consequences
- Every game gets the look for free through the shared components.
- The always-dark TV is a deliberate limit: no daytime light theme for the show.

## Alternatives
A light, kid-pastel look: wrong for the host's attitude and for grown-up nights. A different look per game: no brand.

## Where it lives
`docs/design/`, `apps/web/src/styles/tokens.css`, `apps/web/src/ui/`.
