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
vi.mock("@/lib/db/queries/runtime");
vi.mock("@/lib/services/task", () => ({
  TaskService: vi.fn().mockImplementation(() => ({
    reconcileAgentStatus: vi.fn(),
  })),
}));
vi.mock("@/lib/api/responses", () => ({
  agentToResponse: vi.fn((a: any) => ({ id: a.id, name: a.name })),
}));

import { listAgents, createAgent, getAgentInWorkspace } from "@/lib/db/queries/agent";
import { getAgentRuntimeForWorkspace } from "@/lib/db/queries/runtime";

const mockList = vi.mocked(listAgents);
const mockCreate = vi.mocked(createAgent);
const mockGetRuntime = vi.mocked(getAgentRuntimeForWorkspace);
const mockGetAgent = vi.mocked(getAgentInWorkspace);

beforeEach(() => vi.clearAllMocks());

function makeReq(body?: unknown) {
  const opts: any = { method: body ? "POST" : "GET" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/agents?workspace_id=w1", opts);
}

describe("GET /api/agents", () => {
  it("lists agents in workspace", async () => {
    mockList.mockResolvedValue([{ id: "a1", name: "Bot" }] as any);
    const { GET } = await import("./route");
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/agents", () => {
  it("creates agent with valid input", async () => {
    mockGetRuntime.mockResolvedValue({ id: "rt1", runtimeMode: "local", status: "offline" } as any);
    mockCreate.mockResolvedValue({ id: "a1", name: "Bot" } as any);
    const { POST } = await import("./route");
    const res = await POST(makeReq({ name: "Bot", runtime_id: "rt1" }));
    expect(res.status).toBe(201);
  });

  it("returns 400 for missing name", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ runtime_id: "rt1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing runtime_id", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeReq({ name: "Bot" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when runtime not in workspace", async () => {
    mockGetRuntime.mockResolvedValue(null as any);
    const { POST } = await import("./route");
    const res = await POST(makeReq({ name: "Bot", runtime_id: "rt-bad" }));
    expect(res.status).toBe(404);
  });
});
