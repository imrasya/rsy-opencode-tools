#!/usr/bin/env bun
/**
 * Isolated OpenCode dev sandbox.
 * - Plugin loads from THIS repo (not ~/.config/opencode/cli)
 * - Agents built from current src/plugin/agents/*
 * - Does NOT modify production ~/.config/opencode
 *
 * Soft mode (default): OPENCODE_CONFIG only — keeps global providers/auth.
 * Hard mode (--hard): XDG_CONFIG_HOME sandbox — full isolation; copies model+provider.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, chmodSync } from "fs";
import { join, resolve } from "path";
import { buildAgentConfigs } from "../src/plugin/config.js";
import {
  buildNativeAgents,
  DEFAULT_PERMISSION,
  DEFAULT_COMMANDS,
} from "../src/lib/opencode-json-template.js";

const REPO = resolve(import.meta.dir, "..");
const SANDBOX = join(REPO, ".dev-sandbox");
const hard = process.argv.includes("--hard");
const verifyOnly = process.argv.includes("--verify");
const printEnv = process.argv.includes("--env");

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function main(): void {
  mkdirSync(SANDBOX, { recursive: true });

  const pluginPath = join(REPO, "src/plugin/index.ts").replace(/\\/g, "/");
  const agents = buildNativeAgents(buildAgentConfigs());
  const agentIds = Object.keys(agents).sort();

  const prodConfig = readJson(join(process.env.HOME ?? "", ".config/opencode/opencode.json")) ?? {};

  // Disable legacy agent names that may still exist in global ~/.config/opencode
  const legacyDisabled = Object.fromEntries(
    ["jce-worker", "jce-researcher", "oracle", "sisyphus", "librarian"].map((id) => [
      id,
      { disable: true },
    ]),
  );

  const config: Record<string, unknown> = {
    $schema: "https://opencode.ai/config.json",
    plugin: [
      `file://${pluginPath}`,
      // Goal mode (Codex-style long-running objectives) — same default as RSY install
      [
        "@prevalentware/opencode-goal-plugin",
        {
          auto_continue: true,
          defer_while_tasks_active: true,
          max_auto_turns: 25,
          restricted_agents: ["plan", "plan-critic"],
          allow_goal_execution_from_plan: false,
        },
      ],
    ],
    agent: { ...legacyDisabled, ...agents },
    default_agent: "coder",
    permission: DEFAULT_PERMISSION,
    formatter: true,
    command: DEFAULT_COMMANDS,
  };

  // Soft: inherit providers from global merge. Hard: copy model+provider into sandbox.
  if (hard) {
    if (prodConfig.model) config.model = prodConfig.model;
    if (prodConfig.provider) config.provider = prodConfig.provider;
    if (prodConfig.small_model) config.small_model = prodConfig.small_model;
  }

  const configPath = join(SANDBOX, "opencode.json");
  writeJson(configPath, config);

  // Minimal AGENTS.md so sandbox has identity without overwriting production
  writeFileSync(
    join(SANDBOX, "AGENTS.md"),
    "# Dev sandbox\nIsolated RSY plugin test. Do not use for production work.\n",
    "utf8",
  );

  const xdgHome = join(SANDBOX, "xdg");
  if (hard) {
    mkdirSync(join(xdgHome, "opencode"), { recursive: true });
    writeJson(join(xdgHome, "opencode", "opencode.json"), config);
  }

  // Shell launcher
  const softLaunch = `#!/usr/bin/env bash
# Soft isolation: production ~/.config/opencode untouched for plugin install.
# This process only overrides plugin + agents via OPENCODE_CONFIG.
set -euo pipefail
ROOT="${REPO}"
export OPENCODE_CONFIG="$ROOT/.dev-sandbox/opencode.json"
# Optional: pin data dir so sessions don't mix (OpenCode still uses global data by default)
echo "→ Soft sandbox"
echo "  OPENCODE_CONFIG=$OPENCODE_CONFIG"
echo "  plugin=file://$ROOT/src/plugin/index.ts"
echo "  agents: ${agentIds.join(", ")}"
echo "  production ~/.config/opencode/cli NOT used"
exec opencode "$@"
`;

  const hardLaunch = `#!/usr/bin/env bash
# Hard isolation: separate XDG_CONFIG_HOME. Production config never read as primary.
set -euo pipefail
ROOT="${REPO}"
export XDG_CONFIG_HOME="$ROOT/.dev-sandbox/xdg"
export OPENCODE_CONFIG="$ROOT/.dev-sandbox/opencode.json"
echo "→ Hard sandbox"
echo "  XDG_CONFIG_HOME=$XDG_CONFIG_HOME"
echo "  OPENCODE_CONFIG=$OPENCODE_CONFIG"
echo "  agents: ${agentIds.join(", ")}"
exec opencode "$@"
`;

  const softPath = join(SANDBOX, "run.sh");
  const hardPath = join(SANDBOX, "run-hard.sh");
  writeFileSync(softPath, softLaunch, "utf8");
  writeFileSync(hardPath, hardLaunch, "utf8");
  chmodSync(softPath, 0o755);
  chmodSync(hardPath, 0o755);

  // Verify agents without launching TUI
  if (verifyOnly) {
    const missing = ["coder", "orchestration", "explorer", "plan", "plan-critic", "android", "frontend", "debugger", "researcher"]
      .filter((id) => !agentIds.includes(id));
    if (missing.length) {
      console.error("FAIL missing agents:", missing.join(", "));
      process.exit(1);
    }
    for (const id of agentIds) {
      const prompt = (agents as Record<string, { prompt?: string }>)[id]?.prompt ?? "";
      if (prompt.length < 80) {
        console.error(`FAIL ${id}: prompt too short (${prompt.length})`);
        process.exit(1);
      }
    }
    console.log("OK sandbox agents:", agentIds.join(", "));
    console.log("OK plugin:", `file://${pluginPath}`);
    console.log("OK config:", configPath);
    console.log("OK soft launcher:", softPath);
    console.log("OK hard launcher:", hardPath);
    return;
  }

  if (printEnv) {
    if (hard) {
      console.log(`export XDG_CONFIG_HOME="${xdgHome}"`);
    }
    console.log(`export OPENCODE_CONFIG="${configPath}"`);
    return;
  }

  console.log("Dev sandbox ready (production install untouched).");
  console.log("");
  console.log("Agents:", agentIds.join(", "));
  console.log("Plugin:", `file://${pluginPath}`);
  console.log("Config:", configPath);
  console.log("");
  console.log("Soft isolation (recommended — keeps your API keys/providers):");
  console.log("  ./.dev-sandbox/run.sh");
  console.log("  ./.dev-sandbox/run.sh agent list");
  console.log("  ./.dev-sandbox/run.sh debug config");
  console.log("  ./.dev-sandbox/run.sh debug agent coder");
  console.log("");
  console.log("Hard isolation (separate XDG; re-run with --hard after generate):");
  console.log("  bun run scripts/dev-sandbox.ts --hard");
  console.log("  ./.dev-sandbox/run-hard.sh");
  console.log("");
  console.log("Verify only:");
  console.log("  bun run scripts/dev-sandbox.ts --verify");
  console.log("");
  console.log("No traditional 'build' step — Bun runs TypeScript directly.");
  console.log("Optional typecheck: bun run typecheck");
}

main();
