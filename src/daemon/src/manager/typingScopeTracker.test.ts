import { describe, it, expect } from "vitest";
import { createTypingScopeTracker } from "./typingScopeTracker.js";

describe("typingScopeTracker", () => {
  it("add + snapshot yields the current scope set", () => {
    const t = createTypingScopeTracker();
    t.add("bot_1", "dm_a");
    t.add("bot_1", "dm_b");
    expect(t.snapshot("bot_1").sort()).toEqual(["dm_a", "dm_b"]);
  });

  it("add is idempotent — set semantics prevent duplicate scopes", () => {
    const t = createTypingScopeTracker();
    t.add("bot_1", "dm_a");
    t.add("bot_1", "dm_a");
    t.add("bot_1", "dm_a");
    expect(t.snapshot("bot_1")).toEqual(["dm_a"]);
  });

  it("hasAny reflects presence — false for unknown agents and after clear", () => {
    const t = createTypingScopeTracker();
    expect(t.hasAny("bot_1")).toBe(false);
    t.add("bot_1", "dm_a");
    expect(t.hasAny("bot_1")).toBe(true);
    t.clear("bot_1");
    expect(t.hasAny("bot_1")).toBe(false);
  });

  it("snapshot for an unknown agent returns an empty array", () => {
    const t = createTypingScopeTracker();
    expect(t.snapshot("nobody")).toEqual([]);
  });

  it("clear drops all scopes for one agent — other agents unaffected", () => {
    const t = createTypingScopeTracker();
    t.add("bot_1", "dm_a");
    t.add("bot_2", "dm_b");
    t.clear("bot_1");
    expect(t.snapshot("bot_1")).toEqual([]);
    expect(t.snapshot("bot_2")).toEqual(["dm_b"]);
  });
});
