import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { dirname } from "path";
import { pidFilePath } from "./config.js";
import { log } from "../lib/logger.js";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a PID file to prevent duplicate daemon starts.
 * Returns true if acquired, false if another daemon is already running.
 */
export function acquireDaemonPid(profile?: string): boolean {
  const pidPath = pidFilePath(profile);

  try {
    const content = readFileSync(pidPath, "utf-8").trim();
    const existingPid = parseInt(content, 10);
    if (!isNaN(existingPid) && isProcessAlive(existingPid)) {
      log.error(
        `Another daemon is already running (PID ${existingPid}). ` +
          `Remove ${pidPath} if this is stale.`,
      );
      return false;
    }
  } catch {
    // No existing PID file — proceed
  }

  mkdirSync(dirname(pidPath), { recursive: true, mode: 0o700 });
  writeFileSync(pidPath, String(process.pid), { mode: 0o600 });
  return true;
}

/** Remove the PID file on shutdown. */
export function releaseDaemonPid(profile?: string): void {
  try {
    unlinkSync(pidFilePath(profile));
  } catch {
    // already removed or never existed
  }
}
