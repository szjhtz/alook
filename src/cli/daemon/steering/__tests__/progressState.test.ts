import { describe, it, expect } from "vitest";
import { RuntimeProgressState } from "../progressState.js";

describe("RuntimeProgressState", () => {
  it("starts with isStale=false", () => {
    const ps = new RuntimeProgressState(1000);
    expect(ps.isStale).toBe(false);
    expect(ps.staleSince).toBeNull();
  });

  describe("ageMs", () => {
    it("returns elapsed time since last event", () => {
      const ps = new RuntimeProgressState(1000);
      expect(ps.ageMs(3000)).toBe(2000);
    });

    it("resets after recordRealEvent", () => {
      const ps = new RuntimeProgressState(1000);
      ps.recordRealEvent("text", 5000);
      expect(ps.ageMs(6000)).toBe(1000);
    });

    it("resets after recordInternalProgress", () => {
      const ps = new RuntimeProgressState(1000);
      ps.recordInternalProgress("internal_progress", 5000);
      expect(ps.ageMs(6000)).toBe(1000);
    });
  });

  describe("shouldMarkStale", () => {
    it("returns true when elapsed > threshold", () => {
      const ps = new RuntimeProgressState(1000);
      expect(ps.shouldMarkStale(2000, 5000)).toBe(true);
    });

    it("returns false when elapsed < threshold", () => {
      const ps = new RuntimeProgressState(1000);
      expect(ps.shouldMarkStale(2000, 2500)).toBe(false);
    });

    it("returns false when already stale", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(2000);
      expect(ps.shouldMarkStale(500, 5000)).toBe(false);
    });

    it("uses ageMs internally", () => {
      const ps = new RuntimeProgressState(1000);
      ps.recordRealEvent("text", 4000);
      expect(ps.shouldMarkStale(2000, 5000)).toBe(false);
      expect(ps.shouldMarkStale(2000, 7000)).toBe(true);
    });
  });

  describe("markStale", () => {
    it("sets isStale and staleSince", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(5000);
      expect(ps.isStale).toBe(true);
      expect(ps.staleSince).toBe(5000);
    });

    it("is idempotent — second call does not reset staleSince", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(5000);
      ps.markStale(9000);
      expect(ps.staleSince).toBe(5000);
    });
  });

  describe("recordRealEvent", () => {
    it("clears stale flag", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(5000);
      expect(ps.isStale).toBe(true);
      ps.recordRealEvent("text", 6000);
      expect(ps.isStale).toBe(false);
      expect(ps.staleSince).toBeNull();
    });
  });

  describe("recordInternalProgress", () => {
    it("does NOT clear stale flag", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(5000);
      ps.recordInternalProgress("internal_progress", 6000);
      expect(ps.isStale).toBe(true);
    });
  });

  describe("processEvent", () => {
    it("text → recordRealEvent", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(2000);
      ps.processEvent({ kind: "text", text: "hi" }, 3000);
      expect(ps.isStale).toBe(false);
    });

    it("tool_call → recordRealEvent", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(2000);
      ps.processEvent({ kind: "tool_call", name: "Bash" }, 3000);
      expect(ps.isStale).toBe(false);
    });

    it("internal_progress → recordInternalProgress", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(2000);
      ps.processEvent({ kind: "internal_progress" }, 3000);
      expect(ps.isStale).toBe(true);
    });

    it("compaction_started → recordInternalProgress", () => {
      const ps = new RuntimeProgressState(1000);
      ps.markStale(2000);
      ps.processEvent({ kind: "compaction_started" }, 3000);
      expect(ps.isStale).toBe(true);
    });
  });
});
