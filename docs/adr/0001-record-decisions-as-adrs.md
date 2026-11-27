# 0001. Record decisions as ADRs

- **Status:** Proposed
- **Date:** 2026-11-26

## Context
Smartmouth starts with one game and is meant to grow into several. It has a server, a web app for the TV and phones, an
Android TV shell, and an AI content pipeline. Without a record, later sessions re-argue early choices or quietly
undo them. The owner's other projects (colors, Crayon Box, WhatsOn) use ADRs for this, and the owner asked for the same here
(2026-11-26).

## Decision
Each design decision gets one short file in `docs/adr/`, from [template.md](template.md), with these sections: Context, Decision,
Consequences, Alternatives, Where it lives. Status is `Proposed`, `Accepted`, `Deferred`, `Rejected` or
`Superseded by NNNN`. An agent writes ADRs as **Proposed**, and the owner sets them to **Accepted**. A Proposed ADR may be
edited. An Accepted one is never rewritten; it can only be superseded by a new ADR.

The first batch (0002–0020) was written on 2026-11-26 alongside the scaffold, from the owner's brief. Where code
doesn't exist yet, "Where it lives" names the planned location.

## Consequences
- Decisions are easy to find, and each says what it costs.
- Writing them before most of the code means some will be wrong. Expect a few to be superseded in milestone 1.

## Alternatives
One big design doc: it's hard to change one decision without touching the rest. No record: see Context.

## Where it lives
`docs/adr/`, indexed in [README.md](README.md). The memory and journal ([CLAUDE.md](../../CLAUDE.md)) hold facts and
history; they don't replace an ADR.
