# CLAUDE.md — rsy-opencode-tools

## Memory

**Primary:** context-keeper → local `.opencode-context.md`
- Session start: `context_read`
- After tasks: `context_update`
- Session end: `context_checkpoint`

## Project snapshot
- OpenCode plugin/CLI toolkit — TypeScript + Bun
- Primary agent: **coder** (Explore-Before-Code orchestrator)
- Agents: coder, orchestration, debugger, explorer, frontend, plan, plan-critic, researcher, android
- `@orchestration` = workflow mode on principal: explore → plan → optional plan-critic → **inline write** → report
- Coder/orchestration implement INLINE; never Task/coder or nest orchestration on other agents
- Commit: `<type>(<scope>): <description>`
- Version sync: package.json, install.ps1, install.sh, constants.ts, version.ts

## Rules
- Correctness > Clarity > Evidence > Simplicity > Reversibility
- No guess-fix. Evidence first. 3 fails → stop.
- Verify before claim. Shortest safe diff. YAGNI.
