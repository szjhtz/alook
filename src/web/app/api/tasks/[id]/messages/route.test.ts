import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/task");
vi.mock("@/lib/db/queries/task-message");
vi.mock("@/lib/api/responses", () => ({
  taskMessageToResponse: vi.fn((m: any) => ({ id: m.id, seq: m.seq })),
}));

import { getTask } from "@/lib/db/queries/task";
import { listTaskMessages, listTaskMessagesSince } from "@/lib/db/queries/task-message";

const mockGetTask = vi.mocked(getTask);
const mockListAll = vi.mocked(listTaskMessages);
const mockListSince = vi.mocked(listTaskMessagesSince);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/tasks/[id]/messages", () => {
  it("lists all messages", async () => {
    mockGetTask.mockResolvedValue({ id: "t1", workspaceId: "w1" } as any);
    mockListAll.mockResolvedValue([{ id: "m1", seq: 1 }] as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/tasks/t1/messages?workspace_id=w1"),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("filters by since parameter", async () => {
    mockGetTask.mockResolvedValue({ id: "t1", workspaceId: "w1" } as any);
    mockListSince.mockResolvedValue([{ id: "m2", seq: 2 }] as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/tasks/t1/messages?workspace_id=w1&since=1"),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockListSince).toHaveBeenCalledWith(expect.anything(), "t1", 1);
  });

  it("returns 400 for invalid since parameter", async () => {
    mockGetTask.mockResolvedValue({ id: "t1", workspaceId: "w1" } as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/tasks/t1/messages?workspace_id=w1&since=abc"),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when task not found", async () => {
    mockGetTask.mockResolvedValue(null as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/tasks/t1/messages?workspace_id=w1"),
      { params: Promise.resolve({ id: "t1" }) },
    );
    expect(res.status).toBe(404);
  });
});
