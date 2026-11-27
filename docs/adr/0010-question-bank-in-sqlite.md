# 0010. The question library: SQLite, graded on several axes, managed in /admin

- **Status:** Proposed
- **Date:** 2026-11-26 (revised the same day: the owner asked for a library in admin with grades for age range,
  difficulty, recency and category, "and any other ideas")

## Context
Questions come from hand-written seeds, AI generation and news. They need to suit age bands (ADR 0008), be reviewed
before they reach kids (ADR 0011), and go stale (news, ADR 0012). The game has to pick fresh, fitting questions fast,
and a grown-up needs to see what's there, fix it, and spot gaps.

## Decision
**Storage:** one SQLite file in the data folder (`node:sqlite`, no ORM). Migrations are numbered steps in `db.ts`, and
`PRAGMA user_version` records how far a file has got. A shipped step is never edited.

**Every question is graded on these axes** (rules in `packages/protocol/src/questions.ts`, shared by the server and the admin page):

| Grade | Values | Notes |
|---|---|---|
| **Age range** | youngest band → oldest band | A range, not one band: "bees make honey" suits Kids to Tweens. It counts for every band inside. |
| **Difficulty** | 1–5 | Relative to the **youngest** age in the range: 1 gimme, 3 about half get it, 5 brutal. |
| **Plays as** | 1–5, measured | From the share who got it right, once it has been asked 8 times. When it's 2+ off the graded difficulty, the question is flagged. |
| **Freshness** | evergreen · dated · current | Dated answers can change (records, populations, "tallest building") and carry the date they were checked, with a flag after a year. Current events carry an expiry. |
| **Category** | 20 fixed categories | Including **House** (questions about the family). |
| **Tags** | free, up to 10 | For finer themes (ocean, records, myths). |
| **Kind** | choice · true/false · picture | Picture is the Little seat (ADR 0009). Little questions have at most 3 answers. |
| **Spice** | Mild … Filthy | It can't be above the cap for the youngest age in its range (ADR 0014). |
| **Region** | anywhere · US · our area · our house | "Our house" questions are never exported. |
| **Season** | optional | Halloween, winter holidays and the rest. Seasonal questions are picked near their season and rested the rest of the year (when picking is built). |
| **Status** | draft · review · live · retired | Only live questions are played. Imports and AI questions land in review. |
| **Source** | seed · manual · AI · news, plus a reference | Where the fact came from (an article URL, a model, a book). |
| **Play stats** | times asked, times right, average answer time, last asked, flags | Per question, never per person (ADR 0016). |

**"Needs a look"** collects what's due attention: expired current events, dated answers not checked in a year,
questions a grown-up flagged in a game, and questions that play 2+ levels off their grade.

**The admin library** (`/admin`, behind the admin password):
- **Questions:** search (question, answers, tags, notes), a filter for every grade, sorting (recently changed, newest, easiest,
  most played, fewest right), bulk status changes, and an editor beside the list that checks the same rules as the server.
- **Coverage:** live questions per age band × category and per age band × difficulty, with thin cells marked. Tapping a
  cell opens those questions.
- **Export / import:** JSON. Exports leave out "our house" questions. Imports are validated one by one and land in
  review.

**Seeds** live in the repo (`content/seed/*.json`, each with a stable `key`) and are added at start-up if missing.
Edits made in admin are kept. AI and news questions live only in the database and its backup.

**Picking** (build step 2): live, not expired, the room's spice allows it, the player's band is inside the range, not asked in
this room tonight, least recently asked first, with variety across categories and difficulty matched to the player.

## Consequences
- One file is easy to back up with the owner's existing SQLite `.backup` routine on the home server.
- Grading takes a minute per question by hand. The AI pipeline (ADR 0011) will suggest grades, and a grown-up confirms them.
- Questions are original or AI-made, never copied from published quiz books or other games.

## Alternatives
One band per question: duplicates good questions across bands. Postgres: more to run for a few thousand rows. JSON
files only: no stats, and review would be awkward.

## Where it lives
`packages/protocol/src/questions.ts` (grades and rules), `apps/server/src/db.ts`, `apps/server/src/questions.ts`,
`apps/server/src/adminApi.ts`, `apps/server/src/seeds.ts`, `content/seed/`, `apps/web/src/admin/`.
