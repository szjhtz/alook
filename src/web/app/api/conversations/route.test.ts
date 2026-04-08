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
vi.mock("@/lib/db/queries/conversation");
vi.mock("@/lib/api/responses", () => ({
  conversationToResponse: vi.fn((c: any) => ({ id: c.id })),
}));

import { listConversations, createConversation } from "@/lib/db/queries/conversation";
const mockList = vi.mocked(listConversations);
const mockCreate = vi.mocked(createConversation);

beforeEach(() => vi.clearAllMocks());

function makeReq(body?: unknown) {
  const opts: any = { method: body ? "POST" : "GET" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/conversations?workspace_id=w1", opts);
}

describe("GET /api/conversations", () => {
  it("lists conversations", async () => {
    mockList.mockResolvedValue([{ id: "c1" }] as any);
    const { GET } = await import("./route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/conversations", () => {
  it("creates conversation with agent_id", async () => {
    mockCreate.mockResolvedValue({ id: "c1" } as any);
    const { POST } = await import("./route");
    const res = await POST(makeReq({ agent_id: "a1" }));
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing agent_id", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });
});
