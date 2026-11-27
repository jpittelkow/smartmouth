# 0012. Current-events questions from chosen news feeds, with an expiry date

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
The owner wants questions about recent news and events. News is dated, sometimes wrong at first, and often
unsuitable for kids or a party.

## Decision
- **A short list of RSS/Atom feeds** set on the admin page (general news, science, sport, entertainment and
  "weird news"). No scraping of pages that don't offer a feed.
- **A daily job** takes the last day's items, and the text model writes questions **only from the item's text**. Each
  question cites its article URL (`source_ref`) and has `expires_at` (default 30 days). They go through the same check
  and review as ADR 0011.
- **Teens and Grown-ups only.** Kids' "what's new" questions (a new animal at the zoo, a space launch) can be added later
  through a separate kid-safe feed list. This isn't in milestone 1.
- **Topic rules for the writer:** no tragedies, deaths, crimes, war, elections or partisan politics, and no religion.
  Questions are about the event, never a joke at a real person's expense (design guide §3). The checker rejects anything that breaks them.
- **A "Fresh" category** in the game marks these questions, so players know why they're about last week.

## Consequences
- The newest questions need a review pass the same day to be useful. The admin page lists them by expiry.
- The questions only quote the feed text, so the facts depend on the source. The cited URL makes that checkable.

## Alternatives
Live web search during a game: slow and unreviewable. A news API with a paid key: not needed while feeds exist.

## Where it lives
`packages/content/src/news.ts`, the feed list in the server settings, the `/admin` review queue.
