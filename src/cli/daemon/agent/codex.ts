import { spawn } from "child_process";
import { createInterface } from "readline";
import type { AgentBackend, AgentSession } from "./index.js";
import type { ExecOptions, AgentMessage, AgentResult } from "../types.js";

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

export class CodexBackend implements AgentBackend {
  name = "codex";

  constructor(private cliPath: string) {}

  execute(prompt: string, options: ExecOptions): AgentSession {
    const proc = spawn(this.cliPath, ["app-server", "--listen", "stdio://"], {
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
    let requestId = 0;
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

    const sendRpc = (
      method: string,
      params: Record<string, unknown>,
      id?: number,
    ) => {
      const msg: JsonRpcMessage = { jsonrpc: "2.0", method, params };
      if (id !== undefined) msg.id = id;
      try {
        proc.stdin?.write(JSON.stringify(msg) + "\n");
      } catch {
        // stdin closed
      }
    };

    const sendResponse = (id: number, result: unknown) => {
      const msg = { jsonrpc: "2.0" as const, id, result };
      try {
        proc.stdin?.write(JSON.stringify(msg) + "\n");
      } catch {
        // stdin closed
      }
    };

    const resultPromise = new Promise<AgentResult>((resolve) => {
      const stderrChunks: string[] = [];
      let initialized = false;

      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk.toString());
      });

      const rl = createInterface({ input: proc.stdout! });

      rl.on("line", (line: string) => {
        if (!line.trim()) return;

        let msg: JsonRpcMessage;
        try {
          msg = JSON.parse(line);
        } catch {
          pushMessage({ type: "log", content: line, level: "debug" });
          return;
        }

        if (msg.id !== undefined && msg.result !== undefined && !msg.method) {
          if (!initialized) {
            initialized = true;
            startThread(prompt, options);
          }
          return;
        }

        if (msg.method) {
          handleNotification(msg);
          return;
        }

        if (msg.error) {
          lastError = msg.error.message;
          pushMessage({
            type: "error",
            content: msg.error.message,
          });
        }
      });

      const startThread = (prompt: string, opts: ExecOptions) => {
        const threadParams: Record<string, unknown> = {
          instructions: prompt,
        };
        if (opts.model) {
          threadParams.model = opts.model;
        }

        const id = ++requestId;
        sendRpc("thread/start", threadParams, id);
      };

      const handleNotification = (msg: JsonRpcMessage) => {
        switch (msg.method) {
          case "turn/start": {
            pushMessage({
              type: "status",
              status: "turn_start",
            });
            break;
          }

          case "turn/complete": {
            const output = msg.params?.output as string | undefined;
            if (output) lastOutput = output;
            const status = msg.params?.status as string | undefined;

            if (status === "completed" || status === "finished") {
              resultStatus = "completed";
            } else if (status === "error" || status === "failed") {
              resultStatus = "failed";
              lastError = output || "turn failed";
            }
            break;
          }

          case "thread/complete": {
            const output = msg.params?.output as string | undefined;
            if (output) lastOutput = output;
            break;
          }

          case "item/created": {
            const item = msg.params?.item as Record<string, unknown> | undefined;
            if (!item) break;

            const itemType = item.type as string | undefined;
            if (itemType === "message") {
              const content = item.content as
                | { type: string; text?: string }[]
                | undefined;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block.type === "output_text" || block.type === "text") {
                    pushMessage({ type: "text", content: block.text });
                    if (block.text) lastOutput = block.text;
                  }
                }
              }
            } else if (
              itemType === "function_call" ||
              itemType === "tool_call"
            ) {
              pushMessage({
                type: "tool-use",
                tool: (item.name as string) || (item.function as string) || "",
                callId: item.call_id as string,
                input: item.arguments as Record<string, unknown>,
              });
            } else if (itemType === "function_call_output") {
              pushMessage({
                type: "tool-result",
                callId: item.call_id as string,
                output: item.output as string,
              });
            }
            break;
          }

          case "approval/requested": {
            const approvalId = msg.params?.id as number | undefined;
            if (approvalId !== undefined) {
              sendResponse(approvalId, { approved: true });
            }
            const reqId = msg.id;
            if (reqId !== undefined) {
              sendResponse(reqId, { approved: true });
            }
            break;
          }

          default: {
            pushMessage({
              type: "log",
              content: JSON.stringify(msg),
              level: "debug",
            });
          }
        }
      };

      // Send initialize request
      const initId = ++requestId;
      sendRpc("initialize", { client: "alook-daemon", version: "0.1.0" }, initId);

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
          sessionId: "",
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
