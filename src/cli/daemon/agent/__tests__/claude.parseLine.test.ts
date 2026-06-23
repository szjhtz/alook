import { describe, it, expect } from "vitest";
import { ClaudeBackend } from "../claude.js";

const backend = new ClaudeBackend("claude");

describe("ClaudeBackend.parseLine", () => {
  it("empty line returns empty", () => {
    expect(backend.parseLine("")).toEqual([]);
    expect(backend.parseLine("  ")).toEqual([]);
  });

  it("invalid JSON returns log event", () => {
    const events = backend.parseLine("not json");
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("log");
  });

  it("system init → session_init", () => {
    const line = JSON.stringify({ type: "system", subtype: "init", session_id: "sess-123" });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "session_init", sessionId: "sess-123" }]);
  });

  it("assistant text → text", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "hello world" }] },
    });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "text", text: "hello world" }]);
  });

  it("assistant thinking → thinking", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "thinking", text: "let me think" }] },
    });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "thinking", text: "let me think" }]);
  });

  it("assistant tool_use → tool_call", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "Bash", id: "tc-1", input: { command: "ls" } }] },
    });
    const events = backend.parseLine(line);
    expect(events).toEqual([{
      kind: "tool_call",
      name: "Bash",
      callId: "tc-1",
      input: { command: "ls" },
    }]);
  });

  it("tool_result → tool_output", () => {
    const line = JSON.stringify({ type: "tool_result", tool_use_id: "tc-1", content: "file.txt" });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "tool_output", callId: "tc-1", output: "file.txt" }]);
  });

  it("result → turn_end with sessionId + enriched telemetry", () => {
    const line = JSON.stringify({
      type: "result",
      result: "done",
      session_id: "s1",
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
        service_tier: "default",
      },
      total_cost_usd: 0.005,
      duration_ms: 1200,
    });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ kind: "turn_end", sessionId: "s1" });
    expect(events[1].kind).toBe("telemetry");
    const telemetry = events[1] as { kind: "telemetry"; attrs: Record<string, unknown>; source?: string };
    expect(telemetry.source).toBe("claude_result_usage");
    expect(telemetry.attrs.cachedInputTokens).toBe(20);
    expect(telemetry.attrs.cacheCreationInputTokens).toBe(10);
    expect(telemetry.attrs.totalCostUsd).toBe(0.005);
    expect(telemetry.attrs.serviceTier).toBe("default");
  });

  it("result with is_error → error + turn_end", () => {
    const line = JSON.stringify({ type: "result", result: "something broke", is_error: true });
    const events = backend.parseLine(line);
    expect(events[0]).toEqual({ kind: "error", message: "something broke" });
    expect(events[1].kind).toBe("turn_end");
  });

  it("turn_end carries sessionId from result", () => {
    const line = JSON.stringify({ type: "result", result: "ok", session_id: "s42" });
    const events = backend.parseLine(line);
    const turnEnd = events.find((e) => e.kind === "turn_end") as { kind: "turn_end"; sessionId?: string };
    expect(turnEnd.sessionId).toBe("s42");
  });

  it("control_request → permission_request", () => {
    const line = JSON.stringify({ type: "control_request", request_id: "req-1", payload: { tool: "Bash" } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{
      kind: "permission_request",
      requestId: "req-1",
      payload: { tool: "Bash" },
    }]);
  });

  it("system compaction → compaction_started", () => {
    const line = JSON.stringify({ type: "system", subtype: "compaction" });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "compaction_started" }]);
  });

  it("system context_pruning → compaction_started", () => {
    const line = JSON.stringify({ type: "system", subtype: "context_pruning" });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "compaction_started" }]);
  });

  it("system compaction_finished → compaction_finished", () => {
    const line = JSON.stringify({ type: "system", subtype: "compaction_finished" });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "compaction_finished" }]);
  });

  it("system status → internal_progress with source and itemType", () => {
    const line = JSON.stringify({ type: "system", subtype: "status", status: "something" });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("internal_progress");
    const ip = events[0] as { kind: "internal_progress"; source?: string; itemType?: string };
    expect(ip.source).toBe("claude_system");
    expect(ip.itemType).toBe("status");
  });

  it("system stream_event → internal_progress", () => {
    const line = JSON.stringify({ type: "system", subtype: "stream_event", data: {} });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("internal_progress");
    const ip = events[0] as { kind: "internal_progress"; source?: string; itemType?: string };
    expect(ip.source).toBe("claude_system");
    expect(ip.itemType).toBe("stream_event");
  });
});

describe("ClaudeBackend.encodeStdinMessage", () => {
  it("encodes a user message", () => {
    const encoded = backend.encodeStdinMessage("hello", "idle");
    expect(encoded).not.toBeNull();
    const parsed = JSON.parse(encoded!);
    expect(parsed.type).toBe("user");
    expect(parsed.message.role).toBe("user");
    expect(parsed.message.content[0].text).toBe("hello");
  });

  it("includes session_id when provided", () => {
    const encoded = backend.encodeStdinMessage("hi", "busy", { sessionId: "s1" });
    const parsed = JSON.parse(encoded!);
    expect(parsed.session_id).toBe("s1");
  });
});
