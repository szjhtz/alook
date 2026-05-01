import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAgent = vi.fn();
const mockListByWorkspace = vi.fn();
const mockCreate = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@alook/shared", async () => {
  const actual = await vi.importActual<typeof import("@alook/shared")>("@alook/shared");
  return {
    ...actual,
    queries: {
      agent: { getAgent: (...a: unknown[]) => mockGetAgent(...a) },
      agentLink: {
        listByWorkspace: (...a: unknown[]) => mockListByWorkspace(...a),
        create: (...a: unknown[]) => mockCreate(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "ws1" })),
}));

vi.mock("@/lib/api/responses", () => ({
  agentLinkToResponse: (row: any) => ({
    id: row.id,
    workspace_id: row.workspaceId,
    source_agent_id: row.sourceAgentId,
    target_agent_id: row.targetAgentId,
    instruction: row.instruction,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }),
}));

import { GET, POST } from "./route";

describe("GET /api/agent-links", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists links scoped to workspace", async () => {
    mockListByWorkspace.mockResolvedValue([
      {
        id: "al_1",
        workspaceId: "ws1",
        sourceAgentId: "ag_a",
        targetAgentId: "ag_b",
        instruction: "collaborate",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    const req = new NextRequest("http://localhost/api/agent-links?workspace_id=ws1");
    const res = await GET(req, {} as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("al_1");
    expect(body[0].source_agent_id).toBe("ag_a");
  });
});

describe("POST /api/agent-links", () => {
  beforeEach(() => vi.clearAllMocks());

  async function post(body: unknown) {
    const req = new NextRequest("http://localhost/api/agent-links", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    return POST(req, {} as any);
  }

  it("creates a link between two agents", async () => {
    mockGetAgent.mockResolvedValue({ id: "ag_a" });
    mockCreate.mockImplementation((_db: any, data: any) => ({
      id: "al_1",
      ...data,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    }));
    const res = await post({
      source_agent_id: "ag_a",
      target_agent_id: "ag_b",
      instruction: "share data",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("al_1");
  });

  it("rejects self-link", async () => {
    const res = await post({
      source_agent_id: "ag_a",
      target_agent_id: "ag_a",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("itself");
  });

  it("returns 404 when source agent not found", async () => {
    mockGetAgent.mockResolvedValueOnce(null);
    const res = await post({
      source_agent_id: "ag_nope",
      target_agent_id: "ag_b",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when target agent not found", async () => {
    mockGetAgent.mockResolvedValueOnce({ id: "ag_a" }).mockResolvedValueOnce(null);
    const res = await post({
      source_agent_id: "ag_a",
      target_agent_id: "ag_nope",
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate link", async () => {
    mockGetAgent.mockResolvedValue({ id: "ag_a" });
    const uniqueErr = new Error("UNIQUE constraint failed");
    (uniqueErr as any).code = "SQLITE_CONSTRAINT_UNIQUE";
    mockCreate.mockRejectedValue(uniqueErr);
    const res = await post({
      source_agent_id: "ag_a",
      target_agent_id: "ag_b",
    });
    expect(res.status).toBe(409);
  });
});
