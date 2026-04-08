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
vi.mock("@/lib/auth/jwt", () => ({
  generateMachineToken: vi.fn(() => "al_raw_token"),
  hashToken: vi.fn(() => "hashed"),
}));
vi.mock("@/lib/api/responses", () => ({
  machineTokenToResponse: vi.fn((t: any) => ({ id: t.id, name: t.name })),
}));

import { listMachineTokens, createMachineToken } from "@/lib/db/queries/machine-token";
const mockList = vi.mocked(listMachineTokens);
const mockCreate = vi.mocked(createMachineToken);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/machine-tokens", () => {
  it("lists tokens", async () => {
    mockList.mockResolvedValue([{ id: "mt1", name: "default" }] as any);
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/machine-tokens?workspace_id=w1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/machine-tokens", () => {
  it("creates token and returns raw token + 201", async () => {
    mockCreate.mockResolvedValue({ id: "mt1", name: "mytoken" } as any);
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/machine-tokens?workspace_id=w1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "mytoken" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toBe("al_raw_token");
  });
});
