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

export function notifySessionIdle(title = "OpenCode", message = "Session ready"): void {
  if (!shouldNotifySessionIdle()) return;
  try {
    if (process.platform === "darwin") {
      const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
      spawn("osascript", ["-e", script], { stdio: "ignore", detached: true }).unref();
      return;
    }
    if (process.platform === "linux") {
      spawn("notify-send", [title, message], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    // never break the session on notify failure
  }
}
