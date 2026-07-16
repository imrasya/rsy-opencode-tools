import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ensureOpenCodeJsonEntries, ensureTuiJsonEntries, stripTrailingCommas, stripBom, sanitizeAgentMap } from "../../src/lib/opencode-config-merge.ts";
import { readdirSync } from "fs";

function tempConfigDir(): string {
  const root = mkdtempSync(join(tmpdir(), "opencode-config-merge-"));
  mkdirSync(root, { recursive: true });
  return root;
}

describe("opencode config merge", () => {
  test("preserves unknown top-level user keys while adding missing JCE entries", () => {
    const configDir = tempConfigDir();
    const configPath = join(configDir, "opencode.json");
    writeFileSync(configPath, JSON.stringify({
      $schema: "https://opencode.ai/config.json",
      customTheme: "tokyo-night",
      providers: { custom: { models: ["foo"] } },
    }, null, 2));

    ensureOpenCodeJsonEntries(configDir);

    const merged = JSON.parse(readFileSync(configPath, "utf8"));
    expect(merged.customTheme).toBe("tokyo-night");
    expect(merged.providers).toEqual({ custom: { models: ["foo"] } });
    expect(Array.isArray(merged.plugin)).toBe(true);
    expect(merged.mcp).toBeTruthy();
  });

  test("refuses to rebuild non-empty malformed opencode.json", () => {
    const configDir = tempConfigDir();
    const configPath = join(configDir, "opencode.json");
    writeFileSync(configPath, "{ invalid json");

    expect(() => ensureOpenCodeJsonEntries(configDir)).toThrow("Refusing to rebuild malformed opencode.json automatically");
    expect(readFileSync(configPath, "utf8")).toBe("{ invalid json");
  });

  test("does not duplicate RSY plugin entries on repeated merge", () => {
    const configDir = tempConfigDir();

    ensureOpenCodeJsonEntries(configDir);
    ensureOpenCodeJsonEntries(configDir);

    const merged = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf8"));
    const pluginEntries = Array.isArray(merged.plugin) ? merged.plugin : [];
    const keys = pluginEntries.map((entry: unknown) => Array.isArray(entry) ? entry[0] : entry);
    expect(keys.length).toBe(new Set(keys).size);
  });

  test("ships permission, formatter, and slash commands by default", () => {
    const configDir = tempConfigDir();
    ensureOpenCodeJsonEntries(configDir);
    const merged = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf8"));
    expect(merged.formatter).toBe(true);
    expect(merged.subagent_depth).toBe(3);
    expect(merged.permission.read["*.env"]).toBe("deny");
    expect(merged.permission.bash["rm -rf *"]).toBe("deny");
    expect(merged.permission.doom_loop).toBe("ask");
    expect(merged.command.review).toBeTruthy();
    expect(merged.command.ship).toBeTruthy();
    expect(merged.command.fix).toBeTruthy();
    expect(merged.command.explore).toBeTruthy();
    expect(merged.command.plan).toBeTruthy();
    expect(merged.agent.explorer.permission.edit).toBe("deny");
    expect(merged.agent.plan.permission.edit).toBe("deny");
  });

  test("fills missing subagent_depth without clobbering user value", () => {
    const configDir = tempConfigDir();
    writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
      subagent_depth: 2,
    }, null, 2));
    ensureOpenCodeJsonEntries(configDir);
    const merged = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf8"));
    expect(merged.subagent_depth).toBe(2);

    const configDir2 = tempConfigDir();
    writeFileSync(join(configDir2, "opencode.json"), JSON.stringify({
      customTheme: "x",
    }, null, 2));
    ensureOpenCodeJsonEntries(configDir2);
    const filled = JSON.parse(readFileSync(join(configDir2, "opencode.json"), "utf8"));
    expect(filled.subagent_depth).toBe(3);
    expect(filled.customTheme).toBe("x");
  });

  test("does not override user permission block", () => {
    const configDir = tempConfigDir();
    writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
      permission: { bash: "allow" },
    }, null, 2));
    ensureOpenCodeJsonEntries(configDir);
    const merged = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf8"));
    expect(merged.permission).toEqual({ bash: "allow" });
  });

  test("ships opencode-goal-plugin as default server plugin with options", () => {
    const configDir = tempConfigDir();
    ensureOpenCodeJsonEntries(configDir);
    const merged = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf8"));
    const plugins = Array.isArray(merged.plugin) ? merged.plugin : [];
    const goal = plugins.find((entry: unknown) =>
      entry === "@prevalentware/opencode-goal-plugin"
      || (Array.isArray(entry) && entry[0] === "@prevalentware/opencode-goal-plugin"),
    );
    expect(goal).toBeTruthy();
    expect(Array.isArray(goal)).toBe(true);
    expect(goal[1].restricted_agents).toContain("plan");
    expect(goal[1].restricted_agents).toContain("plan-critic");
    expect(goal[1].auto_continue).toBe(true);
  });

  test("does not override user-configured goal plugin entry", () => {
    const configDir = tempConfigDir();
    writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
      plugin: [["@prevalentware/opencode-goal-plugin", { auto_continue: false }]],
    }, null, 2));
    ensureOpenCodeJsonEntries(configDir);
    const merged = JSON.parse(readFileSync(join(configDir, "opencode.json"), "utf8"));
    const goal = merged.plugin.find((entry: unknown) =>
      Array.isArray(entry) && entry[0] === "@prevalentware/opencode-goal-plugin",
    );
    expect(goal[1].auto_continue).toBe(false);
    // RSY plugin still added
    expect(merged.plugin.some((entry: unknown) => typeof entry === "string" && entry.includes("plugin/index.ts"))).toBe(true);
  });

  test("creates tui.json with Token Savings TUI plugin without duplicating entries", () => {
    const configDir = tempConfigDir();

    ensureTuiJsonEntries(configDir);
    ensureTuiJsonEntries(configDir);

    const merged = JSON.parse(readFileSync(join(configDir, "tui.json"), "utf8"));
    expect(merged.$schema).toBe("https://opencode.ai/tui.json");
    expect(merged.plugin).toContain(`file://${configDir.replace(/\\/g, "/")}/cli/src/plugin/tui.tsx`);
    expect(merged.plugin).toContain("@prevalentware/opencode-goal-plugin");
    expect(merged.plugin.length).toBe(new Set(merged.plugin).size);
    expect(merged.plugin_enabled["rsy-opencode-tools-token-savings"]).toBe(true);
  });

  test("preserves existing user value for JCE-known sections when already configured", () => {
    const configDir = tempConfigDir();
    const configPath = join(configDir, "opencode.json");
    writeFileSync(configPath, JSON.stringify({
      plugin: ["custom-plugin"],
      mcp: { customServer: { type: "remote", url: "https://example.com", enabled: true } },
      lsp: { custom: { command: ["custom-lsp"], extensions: [".foo"] } },
    }, null, 2));

    ensureOpenCodeJsonEntries(configDir);

    const merged = JSON.parse(readFileSync(configPath, "utf8"));
    expect(merged.plugin).toContain("custom-plugin");
    expect(merged.mcp.customServer).toBeTruthy();
    expect(merged.lsp.custom).toBeTruthy();
  });

  test("tidies a recoverable trailing comma instead of refusing, preserving all settings", () => {
    const configDir = tempConfigDir();
    const configPath = join(configDir, "opencode.json");
    // Mirrors the real-world failure: a trailing comma inside an array.
    const malformed = [
      "{",
      '  "model": "9router/kr/claude-opus-4.8",',
      '  "provider": {',
      '    "9router": {',
      '      "models": {',
      '        "codebuddy/claude-opus-4.6": {',
      '          "name": "codebuddy/claude-opus-4.6",',
      '          "modalities": { "input": ["text", "image", "pdf",], "output": ["text"] }',
      "        }",
      "      }",
      "    }",
      "  }",
      "}",
      "",
    ].join("\n");
    writeFileSync(configPath, malformed, "utf8");

    const result = ensureOpenCodeJsonEntries(configDir);
    expect(result.tidied).toBe(true);
    expect(result.backupPath).toBeTruthy();

    // The file is now valid JSON and every user setting is intact.
    const merged = JSON.parse(readFileSync(configPath, "utf8"));
    expect(merged.model).toBe("9router/kr/claude-opus-4.8");
    expect(merged.provider["9router"].models["codebuddy/claude-opus-4.6"].name).toBe("codebuddy/claude-opus-4.6");
    expect(merged.provider["9router"].models["codebuddy/claude-opus-4.6"].modalities.input).toEqual(["text", "image", "pdf"]);
    // JCE entries were still merged in.
    expect(Array.isArray(merged.plugin)).toBe(true);

    // Original malformed content was backed up, not lost.
    const backups = readdirSync(configDir).filter((f) => f.startsWith("opencode.json.invalid-"));
    expect(backups.length).toBeGreaterThanOrEqual(1);
  });

  test("stripTrailingCommas removes only structural trailing commas, never inside strings", () => {
    // Trailing commas before } and ] are removed.
    expect(stripTrailingCommas('{"a":[1,2,],}')).toBe('{"a":[1,2]}');
    // A comma that is a legitimate separator is preserved.
    expect(stripTrailingCommas('{"a":1,"b":2}')).toBe('{"a":1,"b":2}');
    // A comma inside a string value must NOT be touched.
    expect(stripTrailingCommas('{"a":"x, y, z",}')).toBe('{"a":"x, y, z"}');
    // Escaped quotes inside strings handled correctly.
    expect(stripTrailingCommas('{"a":"say \\"hi\\",",}')).toBe('{"a":"say \\"hi\\","}');
  });

  test("stripBom removes a leading BOM only when present", () => {
    expect(stripBom("\uFEFF{}")).toBe("{}");
    expect(stripBom("{}")).toBe("{}");
    // A BOM mid-string is not at index 0, so it is left untouched.
    expect(stripBom('{"a":"x\uFEFFy"}')).toBe('{"a":"x\uFEFFy"}');
  });

  test("sanitizeAgentMap drops invalid mode and disables legacy stubs", () => {
    const { agent, changed } = sanitizeAgentMap({
      coder: { mode: "primary", prompt: "ok", description: "coder" },
      broken: { mode: null, description: "x" },
      "jce-worker": { mode: null, disable: true, description: "Legacy jce-worker (disabled)" },
      oracle: { mode: null },
      garbage: null,
    });
    expect(changed).toBe(true);
    expect(agent.coder).toEqual({ mode: "primary", prompt: "ok", description: "coder" });
    expect(agent.broken).toEqual({ description: "x" }); // mode:null removed
    expect((agent.broken as any).mode).toBeUndefined();
    expect(agent["jce-worker"]).toEqual({ disable: true, description: "Legacy jce-worker (disabled)" });
    expect(agent.oracle).toEqual({ disable: true, description: "Legacy oracle (disabled)" });
    expect(agent.garbage).toBeUndefined();
  });

  test("ensureOpenCodeJsonEntries rewrites mode:null legacy agents so OpenCode schema accepts config", () => {
    const configDir = tempConfigDir();
    const configPath = join(configDir, "opencode.json");
    writeFileSync(configPath, JSON.stringify({
      agent: {
        "jce-worker": { mode: null, disable: true, description: "old" },
        sisyphus: { mode: null },
        explorer: { mode: "all", prompt: "keep-me", description: "explorer" },
      },
    }, null, 2));

    const result = ensureOpenCodeJsonEntries(configDir);
    expect(result.changed).toBe(true);
    const merged = JSON.parse(readFileSync(configPath, "utf8"));
    expect(merged.agent["jce-worker"].mode).toBeUndefined();
    expect(merged.agent["jce-worker"].disable).toBe(true);
    expect(merged.agent.sisyphus).toEqual({ disable: true, description: "Legacy sisyphus (disabled)" });
    expect(merged.agent.explorer.prompt).toBe("keep-me");
    expect(merged.agent.explorer.mode).toBe("all");
    // RSY agents still filled in
    expect(merged.agent.coder).toBeTruthy();
  });

  test("tidies a BOM-prefixed file (the real-world cause) and reformats it cleanly", () => {
    const configDir = tempConfigDir();
    const configPath = join(configDir, "opencode.json");
    // A valid config preceded by a UTF-8 BOM — exactly what PowerShell editors
    // produce, and what made the user's file fail to parse.
    const valid = JSON.stringify({
      model: "9router/kr/claude-opus-4.8",
      provider: { "9router": { options: { baseURL: "http://127.0.0.1:20128/v1" } } },
    });
    writeFileSync(configPath, "\uFEFF" + valid, "utf8");

    const result = ensureOpenCodeJsonEntries(configDir);
    expect(result.tidied).toBe(true);
    expect(result.backupPath).toBeTruthy();

    // File now parses, settings preserved, and it is pretty-printed (2-space),
    // so a previously cramped/BOM'd file becomes easy to read.
    const text = readFileSync(configPath, "utf8");
    expect(text.charCodeAt(0)).not.toBe(0xfeff); // BOM gone
    expect(text).toContain("\n  "); // reformatted with indentation
    const merged = JSON.parse(text);
    expect(merged.model).toBe("9router/kr/claude-opus-4.8");
    expect(merged.provider["9router"].options.baseURL).toBe("http://127.0.0.1:20128/v1");
    expect(Array.isArray(merged.plugin)).toBe(true);
  });
});
