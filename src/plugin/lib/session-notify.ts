/**
 * Lightweight desktop notify when a session goes idle (OpenCode docs plugin pattern).
 * macOS: osascript. Linux: notify-send if present. Windows: skipped (no toast deps).
 */
import { spawn } from "child_process";

let lastNotifyAt = 0;
const MIN_INTERVAL_MS = 15_000;

export function shouldNotifySessionIdle(now = Date.now()): boolean {
  if (now - lastNotifyAt < MIN_INTERVAL_MS) return false;
  lastNotifyAt = now;
  return true;
}

/** Reset throttle (tests). */
export function resetSessionNotifyThrottle(): void {
  lastNotifyAt = 0;
}

/** Spawn desktop notify; swallow missing-binary errors (CI/headless). */
function safeSpawn(cmd: string, args: string[]): void {
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    // spawn errors (ENOENT) are async — try/catch alone is not enough
    child.on("error", () => {});
    child.unref();
  } catch {
    // never break the session on notify failure
  }
}

export function notifySessionIdle(title = "OpenCode", message = "Session ready"): void {
  if (!shouldNotifySessionIdle()) return;
  if (process.platform === "darwin") {
    const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
    safeSpawn("osascript", ["-e", script]);
    return;
  }
  if (process.platform === "linux") {
    safeSpawn("notify-send", [title, message]);
  }
}
