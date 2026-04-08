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
vi.mock("@/lib/db/queries/machine-token");

import { deleteMachineToken } from "@/lib/db/queries/machine-token";
const mockDelete = vi.mocked(deleteMachineToken);

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/machine-tokens/[id]", () => {
  it("deletes token and returns 204", async () => {
    mockDelete.mockResolvedValue(undefined as any);
    const { DELETE } = await import("./route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/machine-tokens/mt1?workspace_id=w1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "mt1" }) },
    );
    expect(res.status).toBe(204);
  });
});
