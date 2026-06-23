import { describe, it, expect } from "vitest";
import { OpenCodeBackend } from "../opencode.js";

const backend = new OpenCodeBackend("opencode");

describe("OpenCodeBackend.parseLine", () => {
  it("empty line returns empty", () => {
    expect(backend.parseLine("")).toEqual([]);
  });

  it("invalid JSON returns log event", () => {
    const events = backend.parseLine("not json");
    expect(events[0].kind).toBe("log");
  });

  it("session → session_init", () => {
    const line = JSON.stringify({ type: "session", session_id: "oc-1" });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "session_init", sessionId: "oc-1" }]);
  });

  it("text with part → text", () => {
    const line = JSON.stringify({ type: "text", part: { text: "answer" } });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "text", text: "answer" });
  });

  it("thinking → thinking", () => {
    const line = JSON.stringify({ type: "thinking", part: { thinking: "hmm" } });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "thinking", text: "hmm" });
  });

  it("tool_call → tool_call", () => {
    const line = JSON.stringify({ type: "tool_call", name: "Bash", call_id: "tc-1", input: { cmd: "ls" } });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({
      kind: "tool_call",
      name: "Bash",
      callId: "tc-1",
      input: { cmd: "ls" },
    });
  });

  it("tool_result → tool_output", () => {
    const line = JSON.stringify({ type: "tool_result", call_id: "tc-1", output: "files" });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({
      kind: "tool_output",
      callId: "tc-1",
      output: "files",
    });
  });

  it("done → turn_end", () => {
    const line = JSON.stringify({ type: "done", output: "result", session_id: "s1" });
    const events = backend.parseLine(line);
    const turnEnds = events.filter((e) => e.kind === "turn_end");
    expect(turnEnds.length).toBeGreaterThanOrEqual(1);
  });

  it("complete with error status → error + turn_end", () => {
    const line = JSON.stringify({ type: "complete", status: "error", output: "failed" });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "error", message: "failed" });
    expect(events).toContainEqual({ kind: "turn_end" });
  });

  it("step_finish reason=stop → turn_end", () => {
    const line = JSON.stringify({ type: "step_finish", part: { reason: "stop" } });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "turn_end" });
  });

  it("step_finish reason=end_turn → turn_end", () => {
    const line = JSON.stringify({ type: "step_finish", part: { reason: "end_turn" } });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "turn_end" });
  });

  it("error → error + turn_end", () => {
    const line = JSON.stringify({ type: "error", message: "boom" });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "error", message: "boom" });
    expect(events).toContainEqual({ kind: "turn_end" });
  });

  it("message with role=assistant → text", () => {
    const line = JSON.stringify({ type: "message", role: "assistant", content: "hello" });
    const events = backend.parseLine(line);
    expect(events).toContainEqual({ kind: "text", text: "hello" });
  });
});

describe("OpenCodeBackend.encodeStdinMessage", () => {
  it("always returns null", () => {
    expect(backend.encodeStdinMessage("hi", "idle")).toBeNull();
    expect(backend.encodeStdinMessage("hi", "busy")).toBeNull();
  });
});
