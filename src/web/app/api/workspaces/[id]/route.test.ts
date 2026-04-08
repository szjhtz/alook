import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/workspace");
vi.mock("@/lib/api/responses", () => ({
  workspaceToResponse: vi.fn((w: any) => ({ id: w.id, name: w.name })),
}));

import { getWorkspace } from "@/lib/db/queries/workspace";
const mockGet = vi.mocked(getWorkspace);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/workspaces/[id]", () => {
  it("returns workspace", async () => {
    mockGet.mockResolvedValue({ id: "w1", name: "WS" } as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/workspaces/w1"),
      { params: Promise.resolve({ id: "w1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockGet.mockResolvedValue(null as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/workspaces/w1"),
      { params: Promise.resolve({ id: "w1" }) },
    );
    expect(res.status).toBe(404);
  });
});
