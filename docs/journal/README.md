# Journal

Short-term memory: a dated log of work sessions, with what was done, what was decided and what's next. Unlike
[memory](../memory/README.md), the journal is append-only history. The newest entry is where to pick up from.

## Rules
- One file per day, `YYYY-MM-DD.md`. Several sessions on one day go in the same file as separate sections.
- Append; don't rewrite past entries. A correction is a new note that says what changed.
- Keep it brief: bullets, with links to ADRs, files and commits instead of pasted content.
- **The privacy rule** in [CLAUDE.md](../../CLAUDE.md) applies: no kids' names or specific identifiers. When noting
  playtest feedback, say "a kid" or "the youngest", not a name.

## Template

```markdown
# YYYY-MM-DD

## Session: <short title>
**Done**
- ...

**Decided**
- ... (link the ADR if one was written or changed)

**Learned / playtest notes**
- ...

**Next**
- ...
```

## Entries
- [2026-11-26](2026-11-26.md): repo created; 20 ADRs proposed; design guide and 16 mockups; build step 1 (rooms,
  join, lobby, reconnects, spice cap) working in the browser; TV shell builds
