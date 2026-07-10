import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetMember = vi.fn()
const mockCreateChannel = vi.fn()
const mockLogAction = vi.fn()
const mockFanOut = vi.fn()

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}))

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }))

vi.mock("@alook/shared", async () => {
  const actual = await vi.importActual<typeof import("@alook/shared")>("@alook/shared")
  return {
    ...actual,
    queries: {
      communityMember: { getMember: (...a: unknown[]) => mockGetMember(...a) },
      communityChannel: {
        createChannel: (...a: unknown[]) => mockCreateChannel(...a),
      },
      communityAuditLog: {
        logAction: (...a: unknown[]) => mockLogAction(...a),
      },
    },
  }
})

vi.mock("@/lib/community/fanout", () => ({
  fanOutToServerMembers: (...a: unknown[]) => mockFanOut(...a),
}))

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params
    return handler(req, { env: { DB: {} }, userId: "u1", email: "u@t.com", params })
  }),
}))

vi.mock("@/lib/middleware/helpers", () => {
  const { NextResponse } = require("next/server")
  return {
    writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
    writeError: (message: string, status: number) =>
      NextResponse.json({ error: message }, { status }),
  }
})

import { POST } from "./route"

const ctx = { params: { id: "s1" } } as any

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/community/servers/s1/channels", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/community/servers/[id]/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMember.mockResolvedValue({ id: "mem_1", userId: "u1", role: "member" })
    mockFanOut.mockResolvedValue(undefined)
    mockLogAction.mockResolvedValue(undefined)
  })

  it("normalizes a spaced name via slugify before creating the channel", async () => {
    mockCreateChannel.mockResolvedValue({
      id: "c1",
      name: "General-Chat",
      type: "text",
      categoryId: null,
      topic: null,
      position: 0,
      createdAt: "2026-07-02T00:00:00.000Z",
    })

    const res = await POST(postReq({ name: "General Chat" }), ctx)
    expect(res.status).toBe(201)
    expect(mockCreateChannel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: "General-Chat" }),
    )
  })

  it("returns 400 (and never calls createChannel) when the name is all disallowed characters", async () => {
    const res = await POST(postReq({ name: "###" }), ctx)
    expect(res.status).toBe(400)
    expect(mockCreateChannel).not.toHaveBeenCalled()
    expect(mockFanOut).not.toHaveBeenCalled()
  })
})
