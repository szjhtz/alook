import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import type { AgentBackend, AgentSession } from "./index.js";
import type { ExecOptions, AgentMessage, AgentResult } from "../types.js";

export class ClaudeBackend implements AgentBackend {
  name = "claude";

  constructor(private cliPath: string) {}

  execute(prompt: string, options: ExecOptions): AgentSession {
    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      "bypassPermissions",
    ];

    if (options.model) {
      args.push("--model", options.model);
    }
    if (options.maxTurns) {
      args.push("--max-turns", String(options.maxTurns));
    }
    if (options.systemPrompt) {
      args.push("--append-system-prompt", options.systemPrompt);
    }
    if (options.resumeSessionId) {
      args.push("--resume", options.resumeSessionId);
    }

    const proc = spawn(this.cliPath, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    if (options.timeout) {
      timeoutTimer = setTimeout(() => {
        proc.kill("SIGTERM");
      }, options.timeout);
    }

    const startTime = Date.now();
    let lastSessionId = "";
    let lastOutput = "";
    let lastError = "";
    let resultStatus: AgentResult["status"] = "completed";

    const messageQueue: AgentMessage[] = [];
    let messageResolve: (() => void) | null = null;
    let messageDone = false;

    const pushMessage = (msg: AgentMessage) => {
      messageQueue.push(msg);
      if (messageResolve) {
        const r = messageResolve;
        messageResolve = null;
        r();
      }
    };

    const resultPromise = new Promise<AgentResult>((resolve) => {
      const stderrChunks: string[] = [];

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk.toString());
      });

      const rl = createInterface({ input: proc.stdout! });

      rl.on("line", (line: string) => {
        if (!line.trim()) return;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          pushMessage({ type: "log", content: line, level: "debug" });
          return;
        }

        const eventType = event.type as string | undefined;

        switch (eventType) {
          case "assistant": {
            const message = event.message as Record<string, unknown> | undefined;
            if (!message) break;
            const content = message.content as
              | { type: string; text?: string; name?: string; id?: string; input?: Record<string, unknown> }[]
              | undefined;
            if (!Array.isArray(content)) break;

            for (const block of content) {
              if (block.type === "text") {
                lastOutput = block.text || "";
                pushMessage({ type: "text", content: block.text });
              } else if (block.type === "thinking") {
                pushMessage({ type: "thinking", content: block.text });
              } else if (block.type === "tool_use") {
                pushMessage({
                  type: "tool-use",
                  tool: block.name,
                  callId: block.id,
                  input: block.input,
                });
              }
            }
            break;
          }

          case "result": {
            const result = event.result as string | undefined;
            const sessionId = event.session_id as string | undefined;
            if (result) lastOutput = result;
            if (sessionId) lastSessionId = sessionId;

            const isError = event.is_error as boolean | undefined;
            if (isError) {
              resultStatus = "failed";
              lastError = result || "unknown error";
            }
            break;
          }

          case "tool_result": {
            const content = event.content as string | undefined;
            const toolUseId = event.tool_use_id as string | undefined;
            pushMessage({
              type: "tool-result",
              callId: toolUseId,
              output: content,
            });
            break;
          }

          case "system": {
            const subtype = event.subtype as string | undefined;
            if (subtype === "init") {
              const sid = event.session_id as string | undefined;
              if (sid) lastSessionId = sid;
            }
            pushMessage({
              type: "status",
              status: subtype || "system",
              content: JSON.stringify(event),
            });
            break;
          }

          case "control": {
            handleControlRequest(proc, event);
            break;
          }

          default: {
            pushMessage({
              type: "log",
              content: line,
              level: "debug",
            });
          }
        }
      });

      proc.on("close", (code: number | null) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);

        if (code !== 0 && resultStatus === "completed") {
          resultStatus = "failed";
        }

        const stderr = stderrChunks.join("");
        if (stderr && !lastError) {
          lastError = stderr;
        }

        messageDone = true;
        if (messageResolve) {
          const r = messageResolve;
          messageResolve = null;
          r();
        }

        resolve({
          status: resultStatus,
          output: lastOutput,
          error: lastError,
          durationMs: Date.now() - startTime,
          sessionId: lastSessionId,
        });
      });
    });

    const messages: AsyncIterable<AgentMessage> = {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<AgentMessage>> {
            while (messageQueue.length === 0 && !messageDone) {
              await new Promise<void>((resolve) => {
                messageResolve = resolve;
              });
            }
            if (messageQueue.length > 0) {
              return { value: messageQueue.shift()!, done: false };
            }
            return { value: undefined as unknown as AgentMessage, done: true };
          },
        };
      },
    };

    return { messages, result: resultPromise };
  }
}

function handleControlRequest(
  proc: ChildProcess,
  event: Record<string, unknown>,
): void {
  const controlId = event.control_id as string | undefined;
  if (!controlId) return;

  const approval = JSON.stringify({
    type: "control_response",
    control_id: controlId,
    approved: true,
  });

  try {
    proc.stdin?.write(approval + "\n");
  } catch {
    // stdin may be closed
  }
}
