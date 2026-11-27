# Owner preferences

What the owner has asked for, beyond what the ADRs spell out.
_Last confirmed: 2026-11-26_

## Product
- A couch party trivia game: TV shows it, phones join on a website, the family's server hosts it on a domain the owner
  will provide. `play.<domain>` is the preferred start (2026-11-26).
- Start with one game, built so more games can be added to choose from (ADR 0006).
- Kids **as young as 3 or 4** must be able to play, with an age choice for each player (ADR 0008, 0009).
- Use AI the way the owner's other apps do: fresh questions, voice generation, and questions about recent news and events
  (ADR 0011–0013).
- **Voice through OpenRouter, like Crayon Box. Not Piper** (2026-11-26).
- **The host is snarky and funny, "a total candy ass"**, with the energy of a swaggering film-pirate rogue crossed with an exasperated
  stand-up comic. **Clean or dirty depending on the age group** (2026-11-26, ADR 0014). It has to stay an original character
  (no real person's likeness or voice), as the persona rules in the design guide say.
- Open to naming ideas (2026-11-26). "Smartmouth" and "Salty" are working names only.
- Wants mockups and a UI/UX and branding design guide (2026-11-26).

- **Answers from 2026-11-26:**
  - Smartmouth and Salty are fine as working names.
  - The code goes on **public GitHub**.
  - **Filthy captions are bleeped.**
  - **Salty may say any player's name**, in any room (ADR 0016).
  - **`/admin` uses our own password**, not Cloudflare Access (ADR 0015).
  - The owner will review the ADRs later.

## Working style
- ADRs in the owner's usual format. Memory (long-term) and a journal (short-term) live in the repo (2026-11-26).
- The owner's habit from other projects: see a choice running or mocked up before deciding, rather than only reading
  a comparison.
