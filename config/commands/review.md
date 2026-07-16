---
description: Review current changes (findings by severity)
agent: debugger
---

Review the current uncommitted work.

Context:
!`git status --short`
!`git diff HEAD`

Return findings first, ordered by severity (blocker → major → minor → nit).
Include file:line when possible. No drive-by refactors. End with Verification gaps and recommended next step.
Focus (optional): $ARGUMENTS
