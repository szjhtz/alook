import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/db", () => ({
  db: { transaction: vi.fn(async (fn: any) => fn({})) },
}));
vi.mock("@/lib/db/queries/workspace");
vi.mock("@/lib/db/queries/member");
vi.mock("@/lib/api/responses", () => ({
  workspaceToResponse: vi.fn((w: any) => ({ id: w.id, name: w.name })),
}));

import { listWorkspaces, createWorkspace } from "@/lib/db/queries/workspace";
import { createMember } from "@/lib/db/queries/member";

const mockList = vi.mocked(listWorkspaces);
const mockCreate = vi.mocked(createWorkspace);
const mockCreateMember = vi.mocked(createMember);

beforeEach(() => vi.clearAllMocks());

function makeReq(body?: unknown) {
  const opts: any = { method: body ? "POST" : "GET" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/workspaces", opts);
}

describe("GET /api/workspaces", () => {
  it("lists user workspaces", async () => {
    mockList.mockResolvedValue([{ id: "w1", name: "WS" }] as any);
    const { GET } = await import("./route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("w1");
  });
});

describe("POST /api/workspaces", () => {
  it("creates workspace with member, returns 201", async () => {
    mockCreate.mockResolvedValue({ id: "w1", name: "Test" } as any);
    mockCreateMember.mockResolvedValue({} as any);
    const { POST } = await import("./route");
    const res = await POST(makeReq({ name: "Test", slug: "test" }));
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing name", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ slug: "test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing slug", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ name: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate slug", async () => {
    const err: any = new Error("dup");
    err.code = "23505";
    mockCreate.mockRejectedValue(err);
    const { POST } = await import("./route");
    const res = await POST(makeReq({ name: "Test", slug: "dup" }));
    expect(res.status).toBe(409);
  });
});
