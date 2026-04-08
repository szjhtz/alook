import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/task");

import { getTaskStatus } from "@/lib/db/queries/task";
const mockGetStatus = vi.mocked(getTaskStatus);

beforeEach(() => vi.clearAllMocks());

describe("GET /daemon/tasks/[taskId]/status", () => {
  it("returns task status", async () => {
    mockGetStatus.mockResolvedValue("running" as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/daemon/tasks/t1/status"),
      { params: Promise.resolve({ taskId: "t1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("running");
  });

  it("returns 404 when task not found", async () => {
    mockGetStatus.mockResolvedValue(null as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/daemon/tasks/t1/status"),
      { params: Promise.resolve({ taskId: "t1" }) },
    );
    expect(res.status).toBe(404);
  });
});
