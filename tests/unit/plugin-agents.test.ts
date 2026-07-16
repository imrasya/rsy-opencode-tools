import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { buildAgentConfigs } from "../../src/plugin/config.ts";

const originalXdg = process.env.XDG_CONFIG_HOME;

function tempConfigDir(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `opencode-jce-agents-${name}-`));
  const configDir = join(root, "opencode");
  mkdirSync(configDir, { recursive: true });
  process.env.XDG_CONFIG_HOME = root;
  return configDir;
}

function writeProviderConfig(configDir: string): void {
  writeFileSync(join(configDir, "opencode.json"), JSON.stringify({
    provider: { openai: { models: { "gpt-4o": {}, "gpt-4o-mini": {} } } },
  }), "utf-8");
}

afterEach(() => {
  if (process.env.XDG_CONFIG_HOME?.includes("opencode-jce-agents-")) {
    rmSync(process.env.XDG_CONFIG_HOME, { recursive: true, force: true });
  }
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
});

describe("plugin agents", () => {
  test("builds 9 agent configs with correct IDs", () => {
    const agents = buildAgentConfigs();
    const ids = Object.keys(agents);
    expect(ids).toContain("coder");
    expect(ids).toContain("orchestration");
    expect(ids).toContain("debugger");
    expect(ids).toContain("explorer");
    expect(ids).toContain("frontend");
    expect(ids).toContain("plan");
    expect(ids).toContain("plan-critic");
    expect(ids).toContain("android");
    expect(ids).toContain("researcher");
    expect(ids).not.toContain("jce-worker");
    expect(ids).not.toContain("jce-researcher");
    expect(ids).toHaveLength(9);
  });

  test("debugger sub-agent enforces Mandatory Root Cause Gate for bug delegations", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.debugger.systemPrompt;
    expect(prompt).toContain("Mandatory Root Cause Gate");
    expect(prompt).toContain("Do NOT guess-fix");
    expect(prompt).toContain("Root Cause Evidence");
    expect(prompt).toContain("Output Contract");
    expect(prompt).toContain("## Summary");
    expect(prompt).toContain("## Files");
    expect(prompt).toContain("## Verification");
    expect(prompt).toContain("## Risks");
  });

  test("coder sub-agent follows Explore-Before-Code Protocol", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.coder.systemPrompt;
    expect(prompt).toContain("chain-of-thought");
    expect(prompt).toContain("EXPLORE FIRST");
    expect(prompt).toContain("VERIFY");
    expect(prompt).toContain("Final Response Contract");
    expect(prompt).toContain("Implement INLINE");
    expect(prompt).toContain("Never Task/coder");
    expect(prompt).toContain("Never Task/orchestration");
  });

  test("orchestration is principal workflow mode — inline write, never Task/coder", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.orchestration.systemPrompt;
    expect(prompt).toContain("Explore");
    expect(prompt).toContain("plan-critic");
    expect(prompt).toContain("@orchestration");
    expect(prompt).toContain("Write INLINE");
    expect(prompt).toContain("Never Task/coder");
    expect(prompt).toContain("Final Response Contract");
    expect(prompt).toContain("Phases run");
    expect(prompt).not.toContain("Task/coder for implementation");
  });

  test("frontend sub-agent enforces Root Cause Gate for UI bugs", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.frontend.systemPrompt;
    expect(prompt).toContain("Root Cause Gate");
    expect(prompt).toContain("needs-evidence");
    expect(prompt).toContain("screenshot");
  });

  test("explorer is read-only with structured output contract", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.explorer.systemPrompt;
    expect(prompt).toContain("READ-ONLY");
    expect(prompt).toContain("## Files");
    expect(prompt).toContain("path:line");
  });

  test("plan agent forbids implementation and requires todos + AC", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.plan.systemPrompt;
    expect(prompt).toContain("do NOT implement");
    expect(prompt).toContain("## Todos");
    expect(prompt).toContain("Acceptance Criteria");
  });

  test("plan-critic returns verdict and findings", () => {
    const agents = buildAgentConfigs();
    const prompt = agents["plan-critic"].systemPrompt;
    expect(prompt).toContain("## Verdict");
    expect(prompt).toContain("approve-with-changes");
    expect(prompt).toContain("NO implementation");
  });

  test("android agent enforces root cause and gradle verification", () => {
    const agents = buildAgentConfigs();
    const prompt = agents.android.systemPrompt;
    expect(prompt).toContain("Root Cause Gate");
    expect(prompt).toContain("gradlew");
    expect(prompt).toContain("android_logcat");
  });

  test("agents omit model by default so OpenCode uses the active user model", () => {
    const configDir = tempConfigDir("default-active");
    writeProviderConfig(configDir);
    const agents = buildAgentConfigs();
    for (const agent of Object.values(agents)) {
      expect(agent.model).toBeUndefined();
    }
  });

  test("agents apply valid per-agent model preferences", () => {
    const configDir = tempConfigDir("override");
    writeProviderConfig(configDir);
    writeFileSync(join(configDir, "jce-plugin.json"), JSON.stringify({
      agents: { coder: "openai/gpt-4o", frontend: "openai/gpt-4o-mini" },
    }), "utf-8");
    const agents = buildAgentConfigs();
    expect(agents.coder.model).toBe("openai/gpt-4o");
    expect(agents.frontend.model).toBe("openai/gpt-4o-mini");
    expect(agents.debugger.model).toBeUndefined();
  });

  test("invalid per-agent model preferences are ignored", () => {
    const configDir = tempConfigDir("invalid");
    writeProviderConfig(configDir);
    writeFileSync(join(configDir, "jce-plugin.json"), JSON.stringify({
      agents: { coder: "openai/gpt-nonexistent" },
    }), "utf-8");
    const agents = buildAgentConfigs();
    expect(agents.coder.model).toBeUndefined();
  });
});
