import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { PolicyProfile } from "./verification-gate.js";

export type PolicyProfileSource = "command" | "session" | "project" | "default";

export interface PolicyProfileResolution {
  profile: PolicyProfile;
  source: PolicyProfileSource;
}

interface WorkerConfig {
  policyProfile?: PolicyProfile;
  sessionPolicyProfile?: PolicyProfile;
}

/** @deprecated Use WorkerConfig */
type JceWorkerConfig = WorkerConfig;

const VALID_PROFILES = new Set<PolicyProfile>(["strict", "balanced", "fast"]);
const STATE_DIR = ".rsy-opencode";
const WORKER_CONFIG_FILE = "worker-config.json";
const LEGACY_WORKER_CONFIG_FILE = "jce-worker-config.json";

export function isPolicyProfile(value: unknown): value is PolicyProfile {
  return typeof value === "string" && VALID_PROFILES.has(value as PolicyProfile);
}

export function getWorkerConfigPath(projectRoot: string): string {
  return join(projectRoot, STATE_DIR, WORKER_CONFIG_FILE);
}

/** @deprecated Use getWorkerConfigPath */
export function getJceWorkerConfigPath(projectRoot: string): string {
  return getWorkerConfigPath(projectRoot);
}

function resolveWorkerConfigSourcePath(projectRoot: string): string | undefined {
  const canonical = getWorkerConfigPath(projectRoot);
  if (existsSync(canonical)) return canonical;
  const legacy = join(projectRoot, STATE_DIR, LEGACY_WORKER_CONFIG_FILE);
  if (existsSync(legacy)) return legacy;
  return undefined;
}

function removeSameDirLegacyWorkerConfig(projectRoot: string): void {
  const legacy = join(projectRoot, STATE_DIR, LEGACY_WORKER_CONFIG_FILE);
  if (!existsSync(legacy)) return;
  try {
    unlinkSync(legacy);
  } catch {
    // best-effort
  }
}

function readWorkerConfig(projectRoot: string): WorkerConfig {
  const path = resolveWorkerConfigSourcePath(projectRoot);
  if (!path) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    return {
      policyProfile: isPolicyProfile(parsed.policyProfile) ? parsed.policyProfile : undefined,
      sessionPolicyProfile: isPolicyProfile(parsed.sessionPolicyProfile) ? parsed.sessionPolicyProfile : undefined,
    };
  } catch {
    return {};
  }
}

function writeWorkerConfig(projectRoot: string, config: WorkerConfig): void {
  const path = getWorkerConfigPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
  removeSameDirLegacyWorkerConfig(projectRoot);
}

export function resolvePolicyProfile(projectRoot: string, commandOverride?: unknown): PolicyProfileResolution {
  if (isPolicyProfile(commandOverride)) return { profile: commandOverride, source: "command" };
  const config = readWorkerConfig(projectRoot);
  if (config.sessionPolicyProfile) return { profile: config.sessionPolicyProfile, source: "session" };
  if (config.policyProfile) return { profile: config.policyProfile, source: "project" };
  return { profile: "balanced", source: "default" };
}

export function saveProjectPolicyProfile(projectRoot: string, profile: PolicyProfile): void {
  const config = readWorkerConfig(projectRoot);
  writeWorkerConfig(projectRoot, { ...config, policyProfile: profile });
}

export function saveSessionPolicyProfile(projectRoot: string, profile: PolicyProfile): void {
  const config = readWorkerConfig(projectRoot);
  writeWorkerConfig(projectRoot, { ...config, sessionPolicyProfile: profile });
}

export function clearSessionPolicyProfile(projectRoot: string): void {
  const config = readWorkerConfig(projectRoot);
  const { sessionPolicyProfile: _sessionPolicyProfile, ...next } = config;
  writeWorkerConfig(projectRoot, next);
}
