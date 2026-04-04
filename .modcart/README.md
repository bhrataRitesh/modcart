# .modcart/ — Project Tracking Directory

This directory is your single source of truth for Modcart development.
Never delete it. Commit it to git with the rest of the codebase.

## Files

| File | Purpose |
|------|---------|
| session.json | Machine-readable current state (phase, task, stats) |
| errors.md | Full error log with context and resolutions |
| decisions.md | Architecture Decision Records (ADRs) |
| progress.md | Daily session log |

## The rule

**Every time you complete a task:**
1. Mark [x] in MODCART_PLAN.md
2. Update session.json (currentTask, completedTasks[], stats)
3. Add an entry to progress.md
4. If any errors occurred, add them to errors.md
5. If any non-obvious decisions were made, add them to decisions.md

**Every time an error occurs:**
1. Stop immediately
2. Add full error to errors.md (copy the full stack trace, not just the message)
3. Note which task it belongs to
4. Try the fix
5. Update the entry with root cause + fix
