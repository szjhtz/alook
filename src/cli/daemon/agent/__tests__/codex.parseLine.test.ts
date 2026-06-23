import { describe, it, expect } from "vitest";
import { CodexBackend } from "../codex.js";

const backend = new CodexBackend("codex");

describe("CodexBackend.parseLine — raw protocol", () => {
  it("empty line returns empty", () => {
    expect(backend.parseLine("")).toEqual([]);
  });

  it("invalid JSON returns log event", () => {
    const events = backend.parseLine("not json");
    expect(events[0].kind).toBe("log");
  });

  it("turn/completed → turn_end", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "turn/completed", params: { turn: { status: "completed" } } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "turn_end" }]);
  });

  it("turn/completed with error → error + turn_end", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "turn/completed", params: { turn: { status: "failed", error: { message: "oops" } } } });
    const events = backend.parseLine(line);
    expect(events[0]).toEqual({ kind: "error", message: "oops" });
    expect(events[1]).toEqual({ kind: "turn_end" });
  });

  it("item/completed agentMessage → text", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { item: { type: "agentMessage", text: "answer" } } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "text", text: "answer" }]);
  });

  it("item/started commandExecution → tool_call", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/started", params: { item: { type: "commandExecution", id: "cmd-1" } } });
    const events = backend.parseLine(line);
    expect(events[0].kind).toBe("tool_call");
    expect((events[0] as { callId: string }).callId).toBe("cmd-1");
  });

  it("item/completed commandExecution → tool_output", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { item: { type: "commandExecution", id: "cmd-1", aggregatedOutput: "result" } } });
    const events = backend.parseLine(line);
    expect(events[0].kind).toBe("tool_output");
    expect((events[0] as { output: string }).output).toBe("result");
  });

  it("error notification → error", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "error", params: { error: { message: "bad things" }, willRetry: false } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "error", message: "bad things" }]);
  });

  it("error with willRetry=true emits nothing", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "error", params: { error: { message: "transient" }, willRetry: true } });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(0);
  });

  it("thread/status/changed idle → turn_end", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "thread/status/changed", params: { status: { type: "idle" } } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "turn_end" }]);
  });

  it("response (has id, no method) returns empty", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} });
    expect(backend.parseLine(line)).toEqual([]);
  });

  it("server request (has id AND method) returns empty", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "item/commandExecution/requestApproval", params: {} });
    expect(backend.parseLine(line)).toEqual([]);
  });

  // --- New event mappings ---

  it("item/started mcpToolCall → tool_call with mcp_ prefix", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/started", params: { item: { type: "mcpToolCall", name: "readFile", id: "mcp-1" } } });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tool_call");
    expect((events[0] as { name: string }).name).toBe("mcp_readFile");
  });

  it("item/started webSearch → tool_call web_search", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/started", params: { item: { type: "webSearch", id: "ws-1" } } });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tool_call");
    expect((events[0] as { name: string }).name).toBe("web_search");
  });

  it("item/started collabAgentToolCall → tool_call collab_agent", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/started", params: { item: { type: "collabAgentToolCall", id: "ca-1" } } });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tool_call");
    expect((events[0] as { name: string }).name).toBe("collab_agent");
  });

  it("item/started contextCompaction → compaction_started", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/started", params: { item: { type: "contextCompaction" } } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "compaction_started" }]);
  });

  it("item/completed reasoning → thinking", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { item: { type: "reasoning", text: "I think..." } } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "thinking", text: "I think..." }]);
  });

  it("item/completed mcpToolCall → tool_output", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { item: { type: "mcpToolCall", name: "readFile", id: "mcp-1", output: "file contents" } } });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tool_output");
    expect((events[0] as { name: string }).name).toBe("mcp_readFile");
  });

  it("item/completed contextCompaction → compaction_finished", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { item: { type: "contextCompaction" } } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "compaction_finished" }]);
  });

  it("item/agentMessage/delta → text (not internal_progress)", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "item/agentMessage/delta", params: { delta: "streaming..." } });
    const events = backend.parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("text");
    expect((events[0] as { text: string }).text).toBe("streaming...");
  });
});

describe("CodexBackend.parseLine — legacy protocol", () => {
  it("codex/event agent_message → text", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "codex/event", params: { type: "agent_message", text: "hello" } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "text", text: "hello" }]);
  });

  it("codex/event task_complete → turn_end", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "codex/event", params: { type: "task_complete" } });
    const events = backend.parseLine(line);
    expect(events).toEqual([{ kind: "turn_end" }]);
  });

  it("codex/event exec_command_begin → tool_call", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "codex/event", params: { type: "exec_command_begin", id: "c1" } });
    const events = backend.parseLine(line);
    expect(events[0].kind).toBe("tool_call");
  });

  it("codex/event exec_command_end → tool_output", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", method: "codex/event", params: { type: "exec_command_end", id: "c1", output: "done" } });
    const events = backend.parseLine(line);
    expect(events[0].kind).toBe("tool_output");
  });
});

describe("CodexBackend.encodeStdinMessage", () => {
  it("returns null without threadId", () => {
    expect(backend.encodeStdinMessage("hi", "idle")).toBeNull();
  });

  it("encodes idle mode as turn/start", () => {
    const encoded = backend.encodeStdinMessage("hi", "idle", { threadId: "t1", requestId: 5 });
    const parsed = JSON.parse(encoded!);
    expect(parsed.method).toBe("turn/start");
    expect(parsed.params.threadId).toBe("t1");
    expect(parsed.params.input[0].text).toBe("hi");
  });

  it("encodes busy mode as turn/steer", () => {
    const encoded = backend.encodeStdinMessage("hi", "busy", { threadId: "t1", requestId: 6 });
    const parsed = JSON.parse(encoded!);
    expect(parsed.method).toBe("turn/steer");
  });
});
