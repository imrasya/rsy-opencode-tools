import { buildDebuggerAgent } from "./agents/debugger.js";
import { buildExplorerAgent } from "./agents/explorer.js";
import { buildFrontendAgent } from "./agents/frontend.js";
import { buildCoderAgent } from "./agents/coder.js";
import { buildOrchestrationAgent } from "./agents/orchestration.js";
import { buildPlanAgent } from "./agents/plan.js";
import { buildPlanCriticAgent } from "./agents/plan-critic.js";
import { buildAndroidAgent } from "./agents/android.js";
import { buildResearcherAgent } from "./agents/researcher.js";
import { applyRsyPluginSettings } from "./lib/settings.js";

export interface PluginAgentConfig {
  model?: string;
  systemPrompt: string;
}

export function buildAgentConfigs(): Record<string, PluginAgentConfig> {
  const agents: Record<string, PluginAgentConfig> = {
    coder: buildCoderAgent(),
    orchestration: buildOrchestrationAgent(),
    debugger: buildDebuggerAgent(),
    explorer: buildExplorerAgent(),
    frontend: buildFrontendAgent(),
    plan: buildPlanAgent(),
    "plan-critic": buildPlanCriticAgent(),
    android: buildAndroidAgent(),
    researcher: buildResearcherAgent(),
  };
  return applyRsyPluginSettings(agents);
}
