---
description: Release readiness check before commit/push
agent: coder
---

Prepare a safe ship checklist for this repo.

Context:
!`git status --short`
!`git log --oneline -5`

Check: version sync, tests/typecheck needed, secrets in diff, changelog truth, and whether commit/push is appropriate.
Do NOT commit or push unless the user explicitly asked in $ARGUMENTS.
Focus: $ARGUMENTS
