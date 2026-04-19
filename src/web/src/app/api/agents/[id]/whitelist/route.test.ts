import { NextRequest } from "next/server";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

const mockGetAgent = vi.fn();
const mockGetWhitelist = vi.fn();
const mockAddWhitelist = vi.fn();

vi.mock("@alook/shared", () => ({
  createDb: vi.fn(() => ({})),
  queries: {
    agent: {
      getAgent: (...args: unknown[]) => mockGetAgent(...args),
    },
    whitelist: {
      getWhitelist: (...args: unknown[]) => mockGetWhitelist(...args),
      addWhitelist: (...args: unknown[]) => mockAddWhitelist(...args),
    },
  },
  AddWhitelistRequestSchema: {
    parse(data: unknown) {
      const { z } = require("zod");
      return z.object({ email: z.string().email() }).parse(data);
    },
  },
}));

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { userId: "u1", email: "u@t.com", params });
  }),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

import { GET, POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/agents/[id]/whitelist", () => {
  it("returns whitelist entries", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockGetWhitelist.mockResolvedValue([
      { id: "wl1", email: "alice@co.com", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "wl2", email: "bob@co.com", createdAt: "2024-01-02T00:00:00.000Z" },
    ]);

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist");
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ id: "wl1", email: "alice@co.com", created_at: "2024-01-01T00:00:00Z" });
    expect(body[1]).toEqual({ id: "wl2", email: "bob@co.com", created_at: "2024-01-02T00:00:00Z" });
  });

  it("returns empty array when no entries", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockGetWhitelist.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist");
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist");
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("agent not found");
  });
});

describe("POST /api/agents/[id]/whitelist", () => {
  it("adds email and returns 201", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockAddWhitelist.mockResolvedValue({
      id: "wl1",
      email: "alice@co.com",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist", {
      method: "POST",
      body: JSON.stringify({ email: "alice@co.com" }),
    });
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await POST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: "wl1", email: "alice@co.com", created_at: "2024-01-01T00:00:00Z" });
  });

  it("rejects invalid email with 400", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await POST(req, ctx);

    expect(res.status).toBe(400);
  });

  it("rejects missing email with 400", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await POST(req, ctx);

    expect(res.status).toBe(400);
  });

  it("normalizes email to lowercase", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockAddWhitelist.mockResolvedValue({
      id: "wl1",
      email: "alice@co.com",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist", {
      method: "POST",
      body: JSON.stringify({ email: "Alice@Co.COM" }),
    });
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await POST(req, ctx);

    expect(res.status).toBe(201);
    expect(mockAddWhitelist).toHaveBeenCalledWith(
      expect.anything(),
      "a1",
      "w1",
      "alice@co.com",
    );
  });

  it("handles duplicate with 409", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockAddWhitelist.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist", {
      method: "POST",
      body: JSON.stringify({ email: "alice@co.com" }),
    });
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await POST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("email already whitelisted");
  });

  it("returns 404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/agents/a1/whitelist", {
      method: "POST",
      body: JSON.stringify({ email: "alice@co.com" }),
    });
    const ctx = { params: Promise.resolve({ id: "a1" }) };
    const res = await POST(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("agent not found");
  });
});
