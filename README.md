<div align="center">

# RSY Open Code Tools

### A practical agent toolkit for OpenCode CLI — by RSY

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-green)]()
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-brightgreen)]()

**Install once. Get structured agents, workflows, orchestration, MCP tools, LSP config, and safer updates.**

[Install](#install) · [Agents](#agents) · [Commands](#commands)

</div>

---

## What Is This?

RSY Open Code Tools is a plugin and installer for **OpenCode CLI**. It adds a focused set of agent workflows, orchestration helpers, config tools, MCP integrations, LSP setup, and maintenance commands so OpenCode works more like a complete coding environment.

Built for OpenCode CLI, enhanced with:
- **Matt Pocock engineering skills** (18 skills: TDD, PRD, QA, refactoring, architecture, etc.)
- **RTK** token saver support (60-90% less tokens)
- **Ponytail** laziness-first coding support (~54% less code)
- Agent roster: **coder** + **orchestration** + **debugger** + **explorer** + **plan** + **plan-critic** + **frontend** + **android** + **researcher**

## How Orchestration Works

`@orchestration` is a **workflow mode on the principal engineer** (same class as `coder`). Not a peer that spawns another writer.

- Runs only when you invoke it on the principal session (`@orchestration` / Tab).
- **Implements INLINE** — never `Task/coder`, never nest orchestration on other agents.
- May `Task` only non-write specialists (explorer, plan, plan-critic, researcher, debugger, …).

```text
User request (@orchestration or default coder)
  -> Explore (@explorer)        [optional Task]
  -> Plan small (@plan)         [optional Task]
  -> Optional plan-critic
  -> Execute INLINE (this session writes the code)
  -> Final report to user
```

Specialist routing (also via `@` mention):

- `explorer` → fast codebase mapping and file discovery
- `plan` / `plan-critic` → todos + adversarial plan review
- `researcher` → docs, library behavior, GitHub and web research
- `debugger` → deep root-cause analysis and stubborn bug fixing
- `coder` → primary session: CoT + **inline** implementation
- `frontend` → UI, styling, accessibility, and responsive work
- `android` → Kotlin/Compose, Gradle, logcat, release

## Install

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/imrasya/rsy-opencode-tools/main/install.sh | bash
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/imrasya/rsy-opencode-tools/main/install.ps1 | iex
```

After install:

```bash
rsy-opencode-tools --version
rsy-opencode-tools doctor
```

## What Gets Installed

- RSY plugin agents (coder, orchestration, specialists)
- Orchestration agent flow: explore → plan → optional plan-critic → coder → report
- 9 agents: coder, orchestration, debugger, explorer, plan, plan-critic, frontend, android, researcher
- 92 skill/workflow files (74 base + 18 Matt Pocock skills)
- 20 model profiles
- 6 MCP tools (context-keeper, context7, github-search, memory, playwright, sequential-thinking)
- 28 LSP server configs
- Token Savings TUI sidebar plugin for OpenCode
- Safe config merge and repair helpers
- `rsy-opencode-tools` maintenance CLI

Optional: RTK (token saver) + Ponytail (lazy-first coding) auto-install prompts.

## Agents

| Agent | Role |
|-------|------|
| `coder` | Primary session: explore-before-code + **inline** implement (never Task/coder) |
| `orchestration` | Workflow mode — explore → plan → optional plan-critic → **inline** execute → report |
| `debugger` | Root-cause analysis for stubborn bugs and crashes |
| `explorer` | Fast read-only codebase navigation |
| `plan` | Todo-based planning (no code) |
| `plan-critic` | Adversarial plan review (subagent) |
| `frontend` | UI, components, accessibility, responsive design |
| `android` | Kotlin/Compose, Gradle, logcat, release |
| `researcher` | Evidence-first docs/libs/GitHub research |

Invoke specialists with `@agent` (e.g. `@explorer`, `@plan`, `@orchestration`) or Tab for primary agents.

## Commands

| Command | Description |
|---------|-------------|
| `rsy-opencode-tools doctor` | Full health check of installation |
| `rsy-opencode-tools use <profile>` | Switch model profile |
| `rsy-opencode-tools setup` | Interactive first-time setup |
| `rsy-opencode-tools update` | Update CLI + merge latest config |
| `rsy-opencode-tools validate` | Validate all config files |
| `rsy-opencode-tools tokens` | Token usage history |
| `rsy-opencode-tools skills` | Audit skill routing |
| `rsy-opencode-tools agent` | Manage custom agents |
| `rsy-opencode-tools mcp` | Manage MCP servers |

## Credits / Acknowledgments

This project is a rebrand and continuation of work originally built as **JCE OpenCode Tools** by **[JCE-Joshhh77](https://github.com/JCE-Joshhh77)** ([JCE-Opencode-Tools](https://github.com/JCE-Joshhh77/JCE-Opencode-Tools)).

Huge thanks to Joshhh for the original architecture, installers, agents, orchestration runtime, and the foundation this toolkit still stands on. RSY Open Code Tools builds on that base for open-source use on any machine — no private servers required.

## License

MIT — see [LICENSE](LICENSE).
