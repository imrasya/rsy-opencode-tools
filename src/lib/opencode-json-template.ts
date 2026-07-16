/**
 * Default opencode.json template for fresh installs.
 * Contains all MCP servers and plugin config that should be active out-of-the-box.
 *
 * Format: OpenCode native (NOT Claude Desktop format).
 * - MCP: { "type", "command"/"url", "env", "enabled" }
 * - LSP: auto-detected from installed commands at install time.
 */

import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { commandExistsSync, FILETYPE_EXTENSIONS } from "./utils.js";

// ─── LSP Auto-Detection ──────────────────────────────────────

interface LspEntry {
  command: string[];
  extensions: string[];
}

interface NativeAgentEntry {
  description: string;
  mode: "primary" | "subagent" | "all";
  prompt: string;
  permission?: Record<string, unknown>;
}

/** Safe-by-default permissions (OpenCode docs). User rules still win on merge. */
export const DEFAULT_PERMISSION: Record<string, unknown> = {
  read: {
    "*": "allow",
    "*.env": "deny",
    "*.env.*": "deny",
    "*.env.example": "allow",
  },
  bash: {
    "*": "allow",
    "rm *": "ask",
    "rm -rf *": "deny",
    "git push *": "ask",
    "git push --force*": "deny",
    "git reset --hard*": "deny",
    "sudo *": "ask",
  },
  doom_loop: "ask",
  external_directory: "ask",
};

/** Slash commands shipped with RSY (OpenCode /command). */
export const DEFAULT_COMMANDS: Record<string, { template: string; description: string; agent?: string }> = {
  review: {
    description: "Review current changes (findings by severity)",
    agent: "debugger",
    template: `Review the current uncommitted work.

Context:
!\`git status --short\`
!\`git diff HEAD\`

Return findings first, ordered by severity (blocker → major → minor → nit).
Include file:line when possible. No drive-by refactors. End with Verification gaps and recommended next step.
Focus (optional): $ARGUMENTS`,
  },
  ship: {
    description: "Release readiness check before commit/push",
    agent: "coder",
    template: `Prepare a safe ship checklist for this repo.

Context:
!\`git status --short\`
!\`git log --oneline -5\`

Check: version sync, tests/typecheck needed, secrets in diff, changelog truth, and whether commit/push is appropriate.
Do NOT commit or push unless the user explicitly asked in $ARGUMENTS.
Focus: $ARGUMENTS`,
  },
  fix: {
    description: "Root-cause debug the current failure",
    agent: "debugger",
    template: `Debug the reported failure with Mandatory Root Cause Gate. Do not guess-fix.

User issue: $ARGUMENTS

1. Classify failure type
2. Collect exact error/log evidence
3. Locate fault (file:line)
4. Propose minimal fix plan
5. Only then implement if evidence is solid; verify with the smallest failing command`,
  },
  explore: {
    description: "Map codebase (read-only) for a question",
    agent: "explorer",
    template: `Explore the codebase (read-only). Question: $ARGUMENTS

Return:
## Summary
## Files (path:line)
## Gaps
No edits. No speculative refactors.`,
  },
  plan: {
    description: "Todo-based plan only (no code)",
    agent: "plan",
    template: `Create an execution plan only. Do not implement.

Goal: $ARGUMENTS

Return Goal, Assumptions, Todos (with verify checks), Acceptance Criteria, Risks, Recommended next step.`,
  },
};

export const AGENT_DESCRIPTIONS: Record<string, string> = {
  coder: "Primary orchestrator and execution lead — implements inline (never Task/coder). Explore-before-code; Task only non-write specialists.",
  orchestration: "Multi-agent workflow mode on the principal engineer: explore → plan → optional plan-critic → implement INLINE → report. Not a peer that Task/coder.",
  debugger: "Root-cause analysis and debugging specialist for stubborn bugs, crashes, and hard-to-diagnose failures.",
  explorer: "Fast read-only codebase navigation for mapping files, symbols, references, and implementation details.",
  frontend: "UI/UX and frontend specialist for components, accessibility, responsive design, and visual verification.",
  plan: "Todo-based planning agent: decomposes goals into ordered, verifiable steps without writing code.",
  "plan-critic": "Adversarial plan reviewer: finds holes, weak verification, and unsafe order before implementation.",
  android: "Android specialist for Kotlin/Compose, Gradle/AGP, runtime logcat, tests, security, and release builds.",
  researcher: "Evidence-first research specialist for docs, libraries, GitHub, versions, and source-backed decisions.",
};

const AGENT_MODES: Record<string, NativeAgentEntry["mode"]> = {
  coder: "primary",
  // @mention only as workflow mode; principal still writes inline (not Task/coder).
  orchestration: "all",
  debugger: "all",
  explorer: "all",
  frontend: "all",
  plan: "all",
  "plan-critic": "subagent",
  android: "all",
  researcher: "all",
};

/** Deny nesting orchestration/coder implementers (workflow stays on principal session). */
const DENY_ORCH_AND_CODER_TASK = {
  task: {
    orchestration: "deny",
    coder: "deny",
  },
} as const;

/** Per-agent permission overlays (merged into native agent entries). */
const AGENT_PERMISSIONS: Record<string, Record<string, unknown>> = {
  // Principal: may Task specialists; never nest another implementer/conductor.
  coder: {
    task: {
      "*": "allow",
      orchestration: "deny",
      coder: "deny",
    },
  },
  // Workflow mode: same as principal — write self; Task non-write only.
  orchestration: {
    task: {
      "*": "allow",
      orchestration: "deny",
      coder: "deny",
    },
  },
  explorer: { edit: "deny", ...DENY_ORCH_AND_CODER_TASK },
  researcher: { edit: "deny", ...DENY_ORCH_AND_CODER_TASK },
  plan: { edit: "deny", ...DENY_ORCH_AND_CODER_TASK },
  "plan-critic": { edit: "deny", ...DENY_ORCH_AND_CODER_TASK },
  debugger: { ...DENY_ORCH_AND_CODER_TASK },
  frontend: { ...DENY_ORCH_AND_CODER_TASK },
  android: { ...DENY_ORCH_AND_CODER_TASK },
};

/**
 * Scan lsp.json and return LSP servers whose commands are found in PATH.
 */
export function detectInstalledLsp(configDir: string): Record<string, LspEntry> {
  const lspFile = join(configDir, "lsp.json");
  if (!existsSync(lspFile)) return {};

  let lspData: { lsp: Record<string, { command: string; args: string[]; filetypes: string[] }> };
  try {
    lspData = JSON.parse(readFileSync(lspFile, "utf8"));
  } catch {
    return {};
  }

  const result: Record<string, LspEntry> = {};

  for (const [name, entry] of Object.entries(lspData.lsp || {})) {
    if (!commandExistsSync(entry.command)) continue;

    const extensions: string[] = [];
    for (const ft of entry.filetypes) {
      const exts = FILETYPE_EXTENSIONS[ft];
      if (exts) {
        for (const ext of exts) {
          if (!extensions.includes(ext)) extensions.push(ext);
        }
      }
    }
    if (extensions.length === 0) continue;

    result[name] = {
      command: [entry.command, ...entry.args],
      extensions,
    };
  }

  return result;
}

export function buildNativeAgents(agentConfigs: Record<string, { systemPrompt: string }>): Record<string, NativeAgentEntry> {
  return buildNativeJceAgents(agentConfigs);
}

/** @deprecated Use buildNativeAgents */
export function buildNativeJceAgents(agentConfigs: Record<string, { systemPrompt: string }>): Record<string, NativeAgentEntry> {
  return Object.fromEntries(Object.entries(agentConfigs).map(([id, config]) => {
    const entry: NativeAgentEntry = {
      description: AGENT_DESCRIPTIONS[id] ?? id,
      mode: AGENT_MODES[id] ?? "all",
      prompt: config.systemPrompt,
    };
    if (AGENT_PERMISSIONS[id]) entry.permission = AGENT_PERMISSIONS[id];
    return [id, entry];
  })) as Record<string, NativeAgentEntry>;
}

// ─── Template Builder ────────────────────────────────────────

export function buildDefaultMcpConfig(configDir: string): Record<string, unknown> {
  const contextKeeperPath = join(configDir, "cli", "src", "mcp", "context-keeper.ts")
    .replace(/\\/g, "/");

  return {
    "context-keeper": {
      type: "local",
      command: ["bun", "run", contextKeeperPath],
      env: {
        PROJECT_ROOT: "${PROJECT_ROOT}",
      },
      enabled: true,
    },
    "context7": {
      type: "remote",
      url: "https://mcp.context7.com/mcp",
      enabled: true,
    },
    "github-search": {
      type: "local",
      command: ["npx", "-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}",
      },
      enabled: true,
    },
    "memory": {
      type: "local",
      command: ["npx", "-y", "@modelcontextprotocol/server-memory"],
      enabled: true,
    },
    "playwright": {
      type: "local",
      command: ["npx", "-y", "@playwright/mcp@latest"],
      enabled: true,
    },
    "sequential-thinking": {
      type: "local",
      command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      enabled: true,
    },
  };
}

/**
 * Build the default opencode.json content.
 * @param configDir - The resolved config directory (e.g., ~/.config/opencode)
 *                    Used to compute the context-keeper path and detect LSP.
 */
/** Default npm plugins shipped with RSY installs (server + TUI). */
export const DEFAULT_OPENCODE_GOAL_PLUGIN = [
  "@prevalentware/opencode-goal-plugin",
  {
    auto_continue: true,
    defer_while_tasks_active: true,
    max_auto_turns: 25,
    min_continue_interval_seconds: 3,
    max_prompt_failures: 3,
    // plan + plan-critic stay planning-only; execution resumes on coder/build
    restricted_agents: ["plan", "plan-critic"],
    allow_goal_execution_from_plan: false,
  },
] as const;

/**
 * OpenCode Task nesting budget (top-level config, not per-agent).
 * Principal (coder / @orchestration) implements inline; may Task specialists once.
 * 2+ covers principal→specialist→optional nested helper (not principal→coder).
 */
export const DEFAULT_SUBAGENT_DEPTH = 3;

export function buildDefaultOpenCodeJson(configDir: string, agentConfigs?: Record<string, { systemPrompt: string }>): Record<string, unknown> {
  // Auto-detect installed LSP servers
  const lsp = detectInstalledLsp(configDir);

  return {
    $schema: "https://opencode.ai/config.json",
    // Top-level OpenCode key (O.subagent_depth). Not agent-level.
    subagent_depth: DEFAULT_SUBAGENT_DEPTH,
    plugin: [
      `file://${configDir.replace(/\\/g, "/")}/cli/src/plugin/index.ts`,
      DEFAULT_OPENCODE_GOAL_PLUGIN,
    ],
    agent: agentConfigs ? buildNativeAgents(agentConfigs) : {},
    permission: DEFAULT_PERMISSION,
    formatter: true,
    command: DEFAULT_COMMANDS,
    mcp: buildDefaultMcpConfig(configDir),
    lsp,
  };
}

export function buildDefaultTuiJson(configDir: string): Record<string, unknown> {
  return {
    $schema: "https://opencode.ai/tui.json",
    plugin: [
      `file://${configDir.replace(/\\/g, "/")}/cli/src/plugin/tui.tsx`,
      "@prevalentware/opencode-goal-plugin",
    ],
    plugin_enabled: {
      "rsy-opencode-tools-token-savings": true,
    },
  };
}
