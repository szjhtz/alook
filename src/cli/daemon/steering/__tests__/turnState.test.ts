import { describe, it, expect } from "vitest";
import { RuntimeTurnState } from "../turnState.js";

describe("RuntimeTurnState", () => {
  it("starts with isInTurn=false and canSteerBusy=false", () => {
    const ts = new RuntimeTurnState();
    expect(ts.isInTurn).toBe(false);
    expect(ts.turnId).toBeNull();
    expect(ts.canSteerBusy).toBe(false);
  });

  it("markTurnStarted sets isInTurn=true and canSteerBusy=true", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("turn-1");
    expect(ts.isInTurn).toBe(true);
    expect(ts.turnId).toBe("turn-1");
    expect(ts.canSteerBusy).toBe(true);
  });

  it("markTurnCompleted sets isInTurn=false, canSteerBusy=false", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("turn-1");
    ts.markTurnCompleted();
    expect(ts.isInTurn).toBe(false);
    expect(ts.turnId).toBeNull();
    expect(ts.canSteerBusy).toBe(false);
  });

  it("markTurnStarted without turnId preserves null turnId", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted();
    expect(ts.isInTurn).toBe(false);
    expect(ts.turnId).toBeNull();
    expect(ts.canSteerBusy).toBe(false);
  });

  it("canSteerBusy=false after markToolBoundary", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    expect(ts.canSteerBusy).toBe(true);
    ts.markToolBoundary();
    expect(ts.canSteerBusy).toBe(false);
  });

  it("canSteerBusy=true after markProgress", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    ts.markToolBoundary();
    expect(ts.canSteerBusy).toBe(false);
    ts.markProgress();
    expect(ts.canSteerBusy).toBe(true);
  });

  it("markToolBoundary → markProgress cycle", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    ts.markToolBoundary();
    expect(ts.canSteerBusy).toBe(false);
    ts.markProgress();
    expect(ts.canSteerBusy).toBe(true);
    ts.markToolBoundary();
    expect(ts.canSteerBusy).toBe(false);
  });

  it("thinking event closes gate", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    ts.markToolBoundary(); // thinking
    expect(ts.canSteerBusy).toBe(false);
  });

  it("compaction closes gate, compaction_finished reopens", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    ts.markToolBoundary(); // compaction_started
    expect(ts.canSteerBusy).toBe(false);
    ts.markProgress(); // compaction_finished
    expect(ts.canSteerBusy).toBe(true);
  });

  it("adoptTurnId updates turnId without touching gate", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    ts.markToolBoundary();
    expect(ts.canSteerBusy).toBe(false);
    ts.adoptTurnId("t2");
    expect(ts.turnId).toBe("t2");
    expect(ts.canSteerBusy).toBe(false); // gate still closed
  });

  it("reset clears all state", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    ts.markToolBoundary();
    ts.reset();
    expect(ts.isInTurn).toBe(false);
    expect(ts.turnId).toBeNull();
    expect(ts.canSteerBusy).toBe(false);
  });

  it("multiple start/complete cycles work", () => {
    const ts = new RuntimeTurnState();
    ts.markTurnStarted("t1");
    expect(ts.isInTurn).toBe(true);
    expect(ts.canSteerBusy).toBe(true);
    ts.markTurnCompleted();
    expect(ts.isInTurn).toBe(false);
    ts.markTurnStarted("t2");
    expect(ts.isInTurn).toBe(true);
    expect(ts.turnId).toBe("t2");
    expect(ts.canSteerBusy).toBe(true);
  });
});
