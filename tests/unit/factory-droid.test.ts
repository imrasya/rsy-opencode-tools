import { execFileSync } from "child_process";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { exportFactoryDroidPlugin, syncFactoryDroidPersonalConfig } from "../../src/lib/factory-droid.ts";
import { VERSION } from "../../src/lib/constants.ts";

function fixture(): string {
  return mkdtempSync(join(tmpdir(), "rsy-opencode-tools-factory-"));
}

describe("Factory Droid export", () => {
  test("writes Factory plugin manifest, droids, skills, commands, and MCP config", () => {
    const root = fixture();
    try {
      const out = join(root, "factory-rsy");
      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });

      expect(result.marketplaceName).toBe("factory-rsy");
      expect(result.pluginName).toBe("rsy-opencode-tools");
      expect(result.droids).toEqual(["coder", "orchestration", "debugger", "explorer", "frontend", "plan", "plan-critic", "android", "researcher"]);
      expect(result.skills).toBeGreaterThan(20);
      expect(result.commands).toContain("rsy-review");
      expect(result.commands).toContain("rsy-models");
      expect(result.commands).toContain("rsy-agent-model");
      expect(result.hooks).toEqual(["PreCompact", "SessionEnd", "SessionStart"]);

      const marketplace = JSON.parse(readFileSync(join(out, ".factory-plugin", "marketplace.json"), "utf8"));
      expect(marketplace.name).toBe("factory-rsy");
      expect(marketplace.plugins[0].source).toBe("./rsy-opencode-tools");

      const pluginRoot = join(out, "rsy-opencode-tools");
      const manifest = JSON.parse(readFileSync(join(pluginRoot, ".factory-plugin", "plugin.json"), "utf8"));
      expect(manifest.name).toBe("rsy-opencode-tools");
      expect(manifest.version).toBe(VERSION);

      const coderDroid = readFileSync(join(pluginRoot, "droids", "coder.md"), "utf8");
      expect(coderDroid).toContain("name: coder");
      expect(coderDroid).toContain("model: inherit");
      expect(coderDroid).toContain('"Edit"');
      expect(coderDroid).toContain('"Execute"');
      const explorer = readFileSync(join(pluginRoot, "droids", "explorer.md"), "utf8");
      expect(explorer).toContain('["Read","LS","Grep","Glob"]');

      expect(existsSync(join(pluginRoot, "skills", "typescript", "SKILL.md"))).toBe(true);
      expect(existsSync(join(pluginRoot, "commands", "rsy-android.md"))).toBe(true);
      expect(readFileSync(join(pluginRoot, "commands", "rsy-android.md"), "utf8")).toContain("$ARGUMENTS");
      const modelsCommand = readFileSync(join(pluginRoot, "commands", "rsy-models.md"), "utf8");
      const agentModelCommand = readFileSync(join(pluginRoot, "commands", "rsy-agent-model.md"), "utf8");
      expect(modelsCommand).toContain("DROID_PLUGIN_ROOT");
      expect(agentModelCommand).toContain("$ARGUMENTS");
      expect(modelsCommand).not.toContain("#!/usr/bin/env bun");
      expect(agentModelCommand).not.toContain("setModel(agent, model)");
      expect(readFileSync(join(pluginRoot, "scripts", "rsy-models.js"), "utf8")).toContain("RSY Droid Model Picker");
      expect(readFileSync(join(pluginRoot, "scripts", "rsy-agent-model.js"), "utf8")).toContain("setModel(agent, model)");

      const hooks = JSON.parse(readFileSync(join(pluginRoot, "hooks", "hooks.json"), "utf8"));
      expect(hooks.hooks.PreCompact[0].matcher).toBe("manual|auto");
      expect(hooks.hooks.PreCompact[0].hooks[0].command).toContain("${DROID_PLUGIN_ROOT}/scripts/rsy-context-hook.js");
      expect(hooks.hooks.SessionEnd[0].hooks[0].type).toBe("command");
      expect(hooks.hooks.SessionStart[0].hooks[0].type).toBe("command");
      expect(readFileSync(join(pluginRoot, "scripts", "rsy-context-hook.js"), "utf8")).toContain("Droid ");

      const mcp = JSON.parse(readFileSync(join(pluginRoot, "mcp.json"), "utf8"));
      expect(mcp.mcpServers["context-keeper"].command).toBe("bun");
      expect(mcp.mcpServers["context-keeper"].args[1]).toContain("/cli/src/mcp/context-keeper.ts");
      expect(JSON.stringify(mcp)).not.toContain("${PROJECT_ROOT}");
      const readme = readFileSync(join(out, "README.md"), "utf8");
      expect(readme).toContain(`droid plugin marketplace add "${out}"`);
      expect(readme).toContain("droid plugin install rsy-opencode-tools@factory-rsy");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("syncs personal Factory config for AGENTS.md, droids, skills, and MCP", () => {
    const root = fixture();
    try {
      const out = join(root, "factory-rsy");
      const factoryHome = join(root, ".factory");
      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });
      const synced = syncFactoryDroidPersonalConfig(factoryHome, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli"), pluginDir: result.pluginDir });

      expect(existsSync(join(factoryHome, "AGENTS.md"))).toBe(true);
      expect(existsSync(join(factoryHome, "droids", "coder.md"))).toBe(true);
      expect(existsSync(join(factoryHome, "skills", "typescript", "SKILL.md"))).toBe(true);
      expect(synced.droids).toBe(9);
      expect(synced.skills).toBeGreaterThan(20);
      expect(synced.mcpServers).toContain("context-keeper");
      expect(synced.backups).toEqual([]);
      expect(synced.warnings).toContain("Droid droids use `model: inherit`; verify Factory model/provider settings if requests fail.");

      const mcp = JSON.parse(readFileSync(join(factoryHome, "mcp.json"), "utf8"));
      expect(mcp.mcpServers["context-keeper"].command).toBe("bun");
      expect(JSON.stringify(mcp)).not.toContain("${PROJECT_ROOT}");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("quotes install path and sanitizes marketplace name", () => {
    const root = fixture();
    try {
      const out = join(root, "factory rsy audit");
      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });
      expect(result.marketplaceName).toBe("factory-rsy-audit");
      const readme = readFileSync(join(out, "README.md"), "utf8");
      expect(readme).toContain(`droid plugin marketplace add "${out}"`);
      expect(readme).toContain("droid plugin install rsy-opencode-tools@factory-rsy-audit");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Droid model commands list and set per-agent models", () => {
    const root = fixture();
    try {
      const out = join(root, "factory-rsy");
      const factoryHome = join(root, ".factory");
      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });
      syncFactoryDroidPersonalConfig(factoryHome, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli"), pluginDir: result.pluginDir });
      writeFileSync(join(factoryHome, "settings.json"), JSON.stringify({ customModels: [{ model: "9r/cx/gpt-5.5", displayName: "GPT 5.5" }] }), "utf8");

      const env = { ...process.env, FACTORY_HOME: factoryHome };
      const listBefore = execFileSync(process.execPath, [join(result.pluginDir, "scripts", "rsy-models.js")], { encoding: "utf8", env });
      expect(listBefore).toContain("RSY Droid Model Picker");
      expect(listBefore).toContain("coder           inherit");
      expect(listBefore).toContain("Available Droid AI choices");
      expect(listBefore).toContain("GPT-5.5 / gpt-5.5 [openai]");
      expect(listBefore).toContain("Claude Sonnet 4.6 / claude-sonnet-4-6 [anthropic]");
      expect(listBefore).toContain("GPT 5.5 / 9r/cx/gpt-5.5");
      expect(listBefore).toContain("/rsy-agent-model coder gpt-5.5");

      const setOutput = execFileSync(process.execPath, [join(result.pluginDir, "scripts", "rsy-agent-model.js"), "coder", "9r/cx/gpt-5.5"], { encoding: "utf8", env });
      expect(setOutput).toContain("coder model set to custom:9r/cx/gpt-5.5");
      expect(readFileSync(join(factoryHome, "droids", "coder.md"), "utf8")).toContain("model: custom:9r/cx/gpt-5.5");

      syncFactoryDroidPersonalConfig(factoryHome, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli"), pluginDir: result.pluginDir });
      expect(readFileSync(join(factoryHome, "droids", "coder.md"), "utf8")).toContain("model: custom:9r/cx/gpt-5.5");

      execFileSync(process.execPath, [join(result.pluginDir, "scripts", "rsy-agent-model.js"), "coder", "default"], { encoding: "utf8", env });
      expect(readFileSync(join(factoryHome, "droids", "coder.md"), "utf8")).toContain("model: inherit");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("CLI droid commands list and set personal droid models", () => {
    const root = fixture();
    try {
      const out = join(root, "factory-rsy");
      const factoryHome = join(root, ".factory");
      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });
      syncFactoryDroidPersonalConfig(factoryHome, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli"), pluginDir: result.pluginDir });
      writeFileSync(join(factoryHome, "settings.json"), JSON.stringify({ customModels: [{ model: "9r/cx/gpt-5.5", displayName: "GPT 5.5" }] }), "utf8");

      const env = { ...process.env, FACTORY_HOME: factoryHome };
      const list = execFileSync(process.execPath, [join(process.cwd(), "src", "index.ts"), "droid", "models"], { encoding: "utf8", env });
      expect(list).toContain("RSY Droid Models");
      expect(list).toContain("coder            inherit");
      expect(list).toContain("GPT-5.5 / gpt-5.5 [openai]");
      expect(list).toContain("GPT 5.5 / 9r/cx/gpt-5.5 [custom]");
      expect(list).toContain("rsy-opencode-tools droid agent <agent> <model|default>");

      const set = execFileSync(process.execPath, [join(process.cwd(), "src", "index.ts"), "droid", "agent", "coder", "gpt-5.5"], { encoding: "utf8", env });
      expect(set).toContain("coder model set to gpt-5.5");
      expect(readFileSync(join(factoryHome, "droids", "coder.md"), "utf8")).toContain("model: gpt-5.5");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("Droid context hook checkpoints project context", () => {
    const root = fixture();
    try {
      const out = join(root, "factory-rsy");
      const project = join(root, "project");
      mkdirSync(project, { recursive: true });
      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });
      const hookScript = join(result.pluginDir, "scripts", "rsy-context-hook.js");

      execFileSync(process.execPath, [hookScript], {
        input: JSON.stringify({ cwd: project, hook_event_name: "PreCompact", trigger: "auto" }),
        encoding: "utf8",
      });

      const context = readFileSync(join(project, ".opencode-context.md"), "utf8");
      expect(context).toContain("Droid PreCompact (auto) checkpoint");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("backs up existing personal Factory files before overwriting", () => {
    const root = fixture();
    try {
      const out = join(root, "factory-rsy");
      const factoryHome = join(root, ".factory");
      mkdirSync(join(factoryHome, "droids"), { recursive: true });
      mkdirSync(join(factoryHome, "skills"), { recursive: true });
      writeFileSync(join(factoryHome, "AGENTS.md"), "custom agents\n", "utf8");
      writeFileSync(join(factoryHome, "droids", "custom.md"), "custom droid\n", "utf8");
      writeFileSync(join(factoryHome, "skills", "custom.md"), "custom skill\n", "utf8");

      const result = exportFactoryDroidPlugin(out, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli") });
      const synced = syncFactoryDroidPersonalConfig(factoryHome, { sourceConfigDir: join(process.cwd(), "config"), cliDir: join(root, "cli"), pluginDir: result.pluginDir });

      expect(synced.backups).toHaveLength(3);
      expect(synced.backups.some((backup) => backup.includes("AGENTS.md.jce-backup"))).toBe(true);
      expect(synced.backups.some((backup) => backup.includes("droids.jce-backup"))).toBe(true);
      expect(synced.backups.some((backup) => backup.includes("skills.jce-backup"))).toBe(true);
      for (const backup of synced.backups) expect(existsSync(backup)).toBe(true);
      expect(readFileSync(synced.backups.find((backup) => backup.includes("AGENTS.md.jce-backup"))!, "utf8")).toBe("custom agents\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
