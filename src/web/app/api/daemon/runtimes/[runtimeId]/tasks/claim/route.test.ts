import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/agent");
vi.mock("@/lib/db/queries/task");
vi.mock("@/lib/services/task");
vi.mock("@/lib/api/responses", () => ({
  taskToResponse: vi.fn((t: any) => ({
    id: t.id, agent_id: t.agentId, runtime_id: t.runtimeId,
    conversation_id: t.conversationId, workspace_id: t.workspaceId,
    prompt: t.prompt, status: t.status, priority: t.priority,
    dispatched_at: null, started_at: null, completed_at: null,
    result: null, error: null, created_at: "2024-01-01T00:00:00Z",
  })),
}));

import { TaskService } from "@/lib/services/task";
import { getAgent } from "@/lib/db/queries/agent";
import { getLastTaskSession } from "@/lib/db/queries/task";

const mockGetAgent = vi.mocked(getAgent);
const mockGetLastSession = vi.mocked(getLastTaskSession);

beforeEach(() => vi.clearAllMocks());

describe("POST /daemon/runtimes/[runtimeId]/tasks/claim", () => {
  it("returns { task: null } when no task available", async () => {
    (TaskService as any).mockImplementation(() => ({
      claimTaskForRuntime: vi.fn(async () => null),
    }));
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/daemon/runtimes/r1/tasks/claim", { method: "POST" }),
      { params: Promise.resolve({ runtimeId: "r1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).toBeNull();
  });

  it("returns task with agent data and prior session", async () => {
    const fakeTask = {
      id: "t1", agentId: "a1", runtimeId: "r1", conversationId: "c1",
      workspaceId: "w1", prompt: "do it", status: "dispatched", priority: 0,
    };
    (TaskService as any).mockImplementation(() => ({
      claimTaskForRuntime: vi.fn(async () => fakeTask),
    }));
    mockGetAgent.mockResolvedValue({
      instructions: "be helpful",
      name: "Bot",
      runtimeConfig: { model: "gpt-4" },
    } as any);
    mockGetLastSession.mockResolvedValue({
      sessionId: "sess-old",
      workDir: "/old/work",
    } as any);

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/daemon/runtimes/r1/tasks/claim", { method: "POST" }),
      { params: Promise.resolve({ runtimeId: "r1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task).not.toBeNull();
    expect(body.task.agent.name).toBe("Bot");
    expect(body.task.prior_session_id).toBe("sess-old");
    expect(body.task.prior_work_dir).toBe("/old/work");
  });
});
