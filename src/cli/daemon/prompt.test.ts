import { describe, it, expect } from "vitest";
import { buildPrompt } from "./prompt.js";
import type { Task } from "./types.js";

function makeTask(prompt: string): Task {
  return {
    id: "t1",
    agentId: "a1",
    runtimeId: "r1",
    conversationId: "c1",
    workspaceId: "w1",
    prompt,
    status: "pending",
    priority: 1,
    createdAt: new Date().toISOString(),
  };
}

describe("buildPrompt", () => {
  it("returns task.prompt as-is", () => {
    const task = makeTask("Fix the login bug");
    expect(buildPrompt(task)).toBe("Fix the login bug");
  });

  it("handles empty prompt", () => {
    const task = makeTask("");
    expect(buildPrompt(task)).toBe("");
  });
});
