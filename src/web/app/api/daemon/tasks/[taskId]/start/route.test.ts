import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/services/task");
vi.mock("@/lib/api/responses", () => ({
  taskToResponse: vi.fn((t: any) => ({ id: t.id, status: t.status })),
}));

import { TaskService } from "@/lib/services/task";

beforeEach(() => vi.clearAllMocks());

describe("POST /daemon/tasks/[taskId]/start", () => {
  it("returns started task", async () => {
    (TaskService as any).mockImplementation(() => ({
      startTask: vi.fn(async () => ({ id: "t1", status: "running" })),
    }));
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/daemon/tasks/t1/start", { method: "POST" }),
      { params: Promise.resolve({ taskId: "t1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("running");
  });

  it("returns 400 when task not in dispatched status", async () => {
    (TaskService as any).mockImplementation(() => ({
      startTask: vi.fn(async () => { throw new Error("task not in dispatched status"); }),
    }));
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/daemon/tasks/t1/start", { method: "POST" }),
      { params: Promise.resolve({ taskId: "t1" }) },
    );
    expect(res.status).toBe(400);
  });
});
