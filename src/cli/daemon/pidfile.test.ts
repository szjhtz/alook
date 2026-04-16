import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Use a temp directory for each test
let testDir: string;

vi.mock("./config.js", () => ({
  pidFilePath: (profile?: string) => {
    const name = profile ? `daemon_${profile}.pid` : "daemon.pid";
    return join(testDir, name);
  },
}));

vi.mock("../lib/logger.js", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { acquireDaemonPid, releaseDaemonPid } from "./pidfile.js";

describe("pidfile", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `pidfile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    try {
      for (const name of ["daemon.pid", "daemon_dev.pid"]) {
        try { unlinkSync(join(testDir, name)); } catch {}
      }
      unlinkSync(testDir);
    } catch {}
  });

  it("writes PID file and returns true on fresh acquire", () => {
    const result = acquireDaemonPid();
    expect(result).toBe(true);

    const content = readFileSync(join(testDir, "daemon.pid"), "utf-8");
    expect(parseInt(content, 10)).toBe(process.pid);
  });

  it("returns false when PID file exists and process is alive", () => {
    // Write current process PID — it's alive
    writeFileSync(join(testDir, "daemon.pid"), String(process.pid));

    const result = acquireDaemonPid();
    expect(result).toBe(false);
  });

  it("overwrites stale PID file when process is not running", () => {
    // PID 999999999 is almost certainly not running
    writeFileSync(join(testDir, "daemon.pid"), "999999999");

    const result = acquireDaemonPid();
    expect(result).toBe(true);

    const content = readFileSync(join(testDir, "daemon.pid"), "utf-8");
    expect(parseInt(content, 10)).toBe(process.pid);
  });

  it("release removes PID file", () => {
    writeFileSync(join(testDir, "daemon.pid"), String(process.pid));
    expect(existsSync(join(testDir, "daemon.pid"))).toBe(true);

    releaseDaemonPid();
    expect(existsSync(join(testDir, "daemon.pid"))).toBe(false);
  });

  it("release is no-op if file does not exist", () => {
    // Should not throw
    expect(() => releaseDaemonPid()).not.toThrow();
  });

  it("uses profile-specific PID file path", () => {
    const result = acquireDaemonPid("dev");
    expect(result).toBe(true);

    expect(existsSync(join(testDir, "daemon_dev.pid"))).toBe(true);
  });
});
