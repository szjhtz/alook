import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/runtime");
vi.mock("@/lib/db/queries/task");
vi.mock("@/lib/services/task");

import {
  updateAgentRuntimeHeartbeat,
  markStaleRuntimesOffline,
} from "@/lib/db/queries/runtime";
import { failStaleDispatchedTasks } from "@/lib/db/queries/task";

const mockHeartbeat = vi.mocked(updateAgentRuntimeHeartbeat);
const mockMarkStale = vi.mocked(markStaleRuntimesOffline);
const mockFailStale = vi.mocked(failStaleDispatchedTasks);

beforeEach(() => {
  vi.clearAllMocks();
  mockHeartbeat.mockResolvedValue({ id: "rt1" } as any);
  mockFailStale.mockResolvedValue([]);
});

describe("POST /api/daemon/heartbeat", () => {
  it("updates heartbeat and marks stale runtimes offline", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/daemon/heartbeat", {
        method: "POST",
        body: JSON.stringify({ runtime_id: "rt1" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mockHeartbeat).toHaveBeenCalledWith({}, "rt1");
    expect(mockMarkStale).toHaveBeenCalledOnce();
  });

  it("calls markStaleRuntimesOffline after updating heartbeat", async () => {
    const callOrder: string[] = [];
    mockHeartbeat.mockImplementation(async () => {
      callOrder.push("heartbeat");
      return { id: "rt1" } as any;
    });
    mockMarkStale.mockImplementation(async () => {
      callOrder.push("markStale");
    });

    const { POST } = await import("./route");
    await POST(
      new NextRequest("http://localhost/api/daemon/heartbeat", {
        method: "POST",
        body: JSON.stringify({ runtime_id: "rt1" }),
      }),
    );
    expect(callOrder).toEqual(["heartbeat", "markStale"]);
  });
});
