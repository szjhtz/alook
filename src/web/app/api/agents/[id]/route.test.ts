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
vi.mock("@/lib/db/queries/agent");
vi.mock("@/lib/api/responses", () => ({
  agentToResponse: vi.fn((a: any) => ({ id: a.id })),
}));

import { getAgentInWorkspace } from "@/lib/db/queries/agent";
const mockGet = vi.mocked(getAgentInWorkspace);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/agents/[id]", () => {
  it("returns agent", async () => {
    mockGet.mockResolvedValue({ id: "a1" } as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/agents/a1?workspace_id=w1"),
      { params: Promise.resolve({ id: "a1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockGet.mockResolvedValue(null as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/agents/a1?workspace_id=w1"),
      { params: Promise.resolve({ id: "a1" }) },
    );
    expect(res.status).toBe(404);
  });
});
