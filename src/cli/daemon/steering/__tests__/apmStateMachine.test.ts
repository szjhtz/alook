import { describe, it, expect } from "vitest";
import {
  createInitialApmState,
  reduceApmGatedToolUse,
  reduceApmGatedCompaction,
  reduceApmGatedEnqueue,
  reduceApmGatedTurnEnd,
  reduceApmGatedError,
  reduceApmGatedFlushReadiness,
  reduceApmGatedRecentEvent,
  reduceApmStalledRecoveryTermination,
  reduceApmStartupTimeoutTermination,
  reduceApmIdleState,
  reduceApmGatedAssistantContinuation,
  reduceApmGatedFlush,
  MAX_APM_GATED_STEERING_EVENTS,
} from "../apmStateMachine.js";

describe("ApmGatedSteeringState", () => {
  describe("createInitialApmState", () => {
    it("returns default state", () => {
      const state = createInitialApmState();
      expect(state.isIdle).toBe(false);
      expect(state.phase).toBe("idle");
      expect(state.outstandingToolUses).toBe(0);
      expect(state.compacting).toBe(false);
      expect(state.toolBoundaryFlushDisabled).toBe(false);
      expect(state.pendingMessages).toEqual([]);
      expect(state.recentEvents).toEqual([]);
    });
  });

  describe("reduceApmIdleState", () => {
    it("sets isIdle", () => {
      const state = createInitialApmState();
      const r = reduceApmIdleState(state, { isIdle: true });
      expect(r.nextState.isIdle).toBe(true);
    });
  });

  describe("reduceApmGatedToolUse", () => {
    it("tool_call increments outstanding and enters tool_wait", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedToolUse(state, { kind: "tool_call" });
      expect(r.nextState.outstandingToolUses).toBe(1);
      expect(r.nextState.phase).toBe("tool_wait");
      expect(r.hadOutstandingToolUse).toBe(false);
      expect(r.shouldFlushToolBatch).toBe(false);
    });

    it("tool_output decrements and enters tool_boundary", () => {
      let state = createInitialApmState();
      state = reduceApmGatedToolUse(state, { kind: "tool_call" }).nextState;
      const r = reduceApmGatedToolUse(state, { kind: "tool_output" });
      expect(r.nextState.outstandingToolUses).toBe(0);
      expect(r.nextState.phase).toBe("tool_boundary");
      expect(r.hadOutstandingToolUse).toBe(true);
      expect(r.shouldFlushToolBatch).toBe(true);
    });

    it("3 overlapping tool_calls, flush only after 3rd tool_output", () => {
      let state = createInitialApmState();
      for (let i = 0; i < 3; i++) {
        state = reduceApmGatedToolUse(state, { kind: "tool_call" }).nextState;
      }
      expect(state.outstandingToolUses).toBe(3);

      for (let i = 0; i < 2; i++) {
        const r = reduceApmGatedToolUse(state, { kind: "tool_output" });
        state = r.nextState;
        expect(r.shouldFlushToolBatch).toBe(false);
      }
      const r = reduceApmGatedToolUse(state, { kind: "tool_output" });
      expect(r.shouldFlushToolBatch).toBe(true);
    });

    it("tool_output never goes below 0", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedToolUse(state, { kind: "tool_output" });
      expect(r.nextState.outstandingToolUses).toBe(0);
    });
  });

  describe("reduceApmGatedCompaction", () => {
    it("compaction_started sets compacting and phase", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedCompaction(state, { kind: "compaction_started" });
      expect(r.nextState.compacting).toBe(true);
      expect(r.nextState.phase).toBe("compacting");
    });

    it("compaction_finished clears compacting, enters assistant_continuation", () => {
      let state = createInitialApmState();
      state = reduceApmGatedCompaction(state, { kind: "compaction_started" }).nextState;
      const r = reduceApmGatedCompaction(state, { kind: "compaction_finished" });
      expect(r.nextState.compacting).toBe(false);
      expect(r.nextState.phase).toBe("assistant_continuation");
    });

    it("compaction_interrupted resets compacting without changing phase to assistant_continuation", () => {
      let state = createInitialApmState();
      state = reduceApmGatedCompaction(state, { kind: "compaction_started" }).nextState;
      const r = reduceApmGatedCompaction(state, { kind: "compaction_interrupted" });
      expect(r.nextState.compacting).toBe(false);
      expect(r.nextState.phase).not.toBe("assistant_continuation");
    });
  });

  describe("reduceApmGatedAssistantContinuation", () => {
    it("sets phase to assistant_continuation", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedAssistantContinuation(state);
      expect(r.nextState.phase).toBe("assistant_continuation");
      expect(r.nextState.isIdle).toBe(false);
    });
  });

  describe("reduceApmGatedFlushReadiness", () => {
    it("blocks when not gated", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedFlushReadiness(state, { isGated: false, hasSession: true, inboxLength: 1, reason: "test" });
      expect(r.shouldNotify).toBe(false);
      expect(r.blockedReason).toBe("non_gated");
    });

    it("blocks when no session", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedFlushReadiness(state, { isGated: true, hasSession: false, inboxLength: 1, reason: "test" });
      expect(r.shouldNotify).toBe(false);
      expect(r.blockedReason).toBe("missing_session");
    });

    it("blocks when inbox empty", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedFlushReadiness(state, { isGated: true, hasSession: true, inboxLength: 0, reason: "test" });
      expect(r.shouldNotify).toBe(false);
      expect(r.blockedReason).toBe("empty_inbox");
    });

    it("blocks when tool_boundary_flush_disabled", () => {
      let state = createInitialApmState();
      state = reduceApmGatedError(state, { disableToolBoundaryFlush: true }).nextState;
      const r = reduceApmGatedFlushReadiness(state, { isGated: true, hasSession: true, inboxLength: 1, reason: "test" });
      expect(r.shouldNotify).toBe(false);
      expect(r.blockedReason).toBe("tool_boundary_flush_disabled");
    });

    it("blocks when compacting", () => {
      let state = createInitialApmState();
      state = reduceApmGatedCompaction(state, { kind: "compaction_started" }).nextState;
      const r = reduceApmGatedFlushReadiness(state, { isGated: true, hasSession: true, inboxLength: 1, reason: "test" });
      expect(r.shouldNotify).toBe(false);
      expect(r.blockedReason).toBe("compacting");
    });

    it("blocks when outstanding tool uses", () => {
      let state = createInitialApmState();
      state = reduceApmGatedToolUse(state, { kind: "tool_call" }).nextState;
      const r = reduceApmGatedFlushReadiness(state, { isGated: true, hasSession: true, inboxLength: 1, reason: "test" });
      expect(r.shouldNotify).toBe(false);
      expect(r.blockedReason).toBe("outstanding_tool_uses");
    });

    it("notifies when all conditions met", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedFlushReadiness(state, { isGated: true, hasSession: true, inboxLength: 2, reason: "test" });
      expect(r.shouldNotify).toBe(true);
      expect(r.blockedReason).toBeNull();
      expect(r.effects).toHaveLength(1);
      expect(r.effects[0].kind).toBe("notify_stdin");
      expect(r.effects[0].stdinMode).toBe("busy");
      expect(r.effects[0].clauseId).toBe("SMR-002");
    });
  });

  describe("reduceApmGatedTurnEnd", () => {
    it("with pending messages and conditions met → deliver_stdin", () => {
      let state = createInitialApmState();
      state = reduceApmGatedEnqueue(state, "msg1").nextState;
      const r = reduceApmGatedTurnEnd(state, { inboxLength: 1, supportsStdinNotification: true, hasSession: true });
      expect(r.effects).toHaveLength(1);
      expect(r.effects[0].kind).toBe("deliver_stdin");
      expect(r.effects[0].stdinMode).toBe("idle");
      expect(r.nextState.isIdle).toBe(false);
      expect(r.nextState.phase).toBe("idle");
    });

    it("with no inbox → idle, no effects", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedTurnEnd(state, { inboxLength: 0, supportsStdinNotification: true, hasSession: true });
      expect(r.effects).toHaveLength(0);
      expect(r.nextState.isIdle).toBe(true);
    });

    it("with no defaults → idle, no effects", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedTurnEnd(state);
      expect(r.effects).toHaveLength(0);
      expect(r.nextState.isIdle).toBe(true);
    });

    it("resets tool counts and compaction", () => {
      let state = createInitialApmState();
      state = reduceApmGatedToolUse(state, { kind: "tool_call" }).nextState;
      state = reduceApmGatedCompaction(state, { kind: "compaction_started" }).nextState;
      const r = reduceApmGatedTurnEnd(state);
      expect(r.nextState.outstandingToolUses).toBe(0);
      expect(r.nextState.compacting).toBe(false);
    });
  });

  describe("reduceApmGatedError", () => {
    it("sets phase to error", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedError(state);
      expect(r.nextState.phase).toBe("error");
    });

    it("disableToolBoundaryFlush sets flag", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedError(state, { disableToolBoundaryFlush: true });
      expect(r.nextState.toolBoundaryFlushDisabled).toBe(true);
      expect(r.shouldDisableToolBoundaryFlush).toBe(true);
    });

    it("toolBoundaryFlushDisabled is sticky", () => {
      let state = createInitialApmState();
      state = reduceApmGatedError(state, { disableToolBoundaryFlush: true }).nextState;
      const r = reduceApmGatedError(state);
      expect(r.nextState.toolBoundaryFlushDisabled).toBe(true);
    });
  });

  describe("reduceApmGatedFlush", () => {
    it("records lastFlushReason", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedFlush(state, { reason: "tool_boundary" });
      expect(r.nextState.lastFlushReason).toBe("tool_boundary");
    });
  });

  describe("reduceApmGatedRecentEvent", () => {
    it("appends event summary", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedRecentEvent(state, { event: "tool_call" });
      expect(r.nextState.recentEvents).toHaveLength(1);
      expect(r.nextState.recentEvents[0]).toContain("tool_call");
    });

    it("caps at MAX_APM_GATED_STEERING_EVENTS", () => {
      let state = createInitialApmState();
      for (let i = 0; i < MAX_APM_GATED_STEERING_EVENTS + 5; i++) {
        state = reduceApmGatedRecentEvent(state, { event: `e${i}` }).nextState;
      }
      expect(state.recentEvents).toHaveLength(MAX_APM_GATED_STEERING_EVENTS);
    });
  });

  describe("reduceApmGatedEnqueue", () => {
    it("appends message to pendingMessages", () => {
      const state = createInitialApmState();
      const r = reduceApmGatedEnqueue(state, "hello");
      expect(r.nextState.pendingMessages).toEqual(["hello"]);
    });

    it("accumulates messages", () => {
      let state = createInitialApmState();
      state = reduceApmGatedEnqueue(state, "a").nextState;
      state = reduceApmGatedEnqueue(state, "b").nextState;
      expect(state.pendingMessages).toEqual(["a", "b"]);
    });
  });

  describe("reduceApmStalledRecoveryTermination", () => {
    const baseInput = {
      inboxLength: 1,
      staleForMs: 200_000,
      staleThresholdMs: 120_000,
      runtimeProgressIsStale: true,
      hasSession: true,
      busyDeliveryMode: "none",
      hasDirectStdinRecoveryEvidence: false,
    };

    it("terminates when stale with inbox", () => {
      const state = createInitialApmState();
      const r = reduceApmStalledRecoveryTermination(state, baseInput);
      expect(r.shouldTerminate).toBe(true);
      expect(r.nextState.expectedTerminationReason).toBe("stalled_recovery");
    });

    it("does not terminate with empty inbox", () => {
      const state = createInitialApmState();
      const r = reduceApmStalledRecoveryTermination(state, { ...baseInput, inboxLength: 0 });
      expect(r.shouldTerminate).toBe(false);
      expect(r.blockedReason).toBe("empty_inbox");
    });

    it("does not terminate when not stale", () => {
      const state = createInitialApmState();
      const r = reduceApmStalledRecoveryTermination(state, {
        ...baseInput,
        staleForMs: 10_000,
        runtimeProgressIsStale: false,
      });
      expect(r.shouldTerminate).toBe(false);
      expect(r.blockedReason).toBe("runtime_progress_recent");
    });

    it("already recovering returns alreadyRecovering", () => {
      let state = createInitialApmState();
      state = reduceApmStalledRecoveryTermination(state, baseInput).nextState;
      const r = reduceApmStalledRecoveryTermination(state, baseInput);
      expect(r.shouldTerminate).toBe(false);
      expect(r.alreadyRecovering).toBe(true);
    });
  });

  describe("reduceApmStartupTimeoutTermination", () => {
    it("terminates when no progress events", () => {
      const state = createInitialApmState();
      const r = reduceApmStartupTimeoutTermination(state, { hasRuntimeProgressEvent: false });
      expect(r.shouldTerminate).toBe(true);
      expect(r.nextState.expectedTerminationReason).toBe("startup_timeout");
    });

    it("does not terminate when has progress events", () => {
      const state = createInitialApmState();
      const r = reduceApmStartupTimeoutTermination(state, { hasRuntimeProgressEvent: true });
      expect(r.shouldTerminate).toBe(false);
      expect(r.blockedReason).toBe("runtime_progress_started");
    });
  });
});
