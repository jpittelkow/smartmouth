# Memory

Long-term memory: lasting facts that should carry over between sessions and aren't obvious from the code, git history or ADRs.
Read all of these at the start of a session. They're kept short on purpose. Short-term history (what happened in each
session) lives in the [journal](../journal/README.md).

| File | What it holds |
|---|---|
| [project-state.md](project-state.md) | Current phase, what exists, what's next |
| [preferences.md](preferences.md) | How the owner wants things built and how they like to work |
| [open-questions.md](open-questions.md) | Decisions still waiting on the owner |
| [gotchas.md](gotchas.md) | Non-obvious traps, workarounds and lessons learned |
| [known-bugs.md](known-bugs.md) | Bugs found and not fixed yet |

## Rules for memory files
- **One topic per file**, bullets over prose. Add a new file only when a topic doesn't fit an existing one, and
  add it to the table above.
- **Update in place.** Memory is the current truth, not a history. When a fact changes, rewrite it. When it stops
  being true, delete it. History belongs in the journal.
- **Don't duplicate.** If an ADR, the code or git already records something, link to it instead.
- **Absolute dates** (`2026-11-26`), and note when a fact was last confirmed if it may go stale.
- **The privacy rule** in [CLAUDE.md](../../CLAUDE.md) applies: no kids' names or specific identifiers.
