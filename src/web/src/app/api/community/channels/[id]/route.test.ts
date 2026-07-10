import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mockGetChannel = vi.fn()
const mockGetMember = vi.fn()
const mockUpdateChannel = vi.fn()
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
      communityChannel: {
        getChannel: (...a: unknown[]) => mockGetChannel(...a),
        updateChannel: (...a: unknown[]) => mockUpdateChannel(...a),
      },
      communityMember: { getMember: (...a: unknown[]) => mockGetMember(...a) },
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

import { PATCH } from "./route"

const ctx = { params: { id: "c1" } } as any

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/community/channels/c1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("PATCH /api/community/channels/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetChannel.mockResolvedValue({ id: "c1", serverId: "s1", categoryId: null, creatorId: "u1" })
    mockGetMember.mockResolvedValue({ id: "mem_1", userId: "u1", role: "owner" })
    mockFanOut.mockResolvedValue(undefined)
    mockLogAction.mockResolvedValue(undefined)
  })

  it("normalizes a spaced rename via slugify before calling updateChannel", async () => {
    mockUpdateChannel.mockResolvedValue({ id: "c1", name: "General-Chat" })

    const res = await PATCH(patchReq({ name: "General Chat" }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdateChannel).toHaveBeenCalledWith(expect.anything(), "c1", { name: "General-Chat" })
  })

  it("returns 400 (and never calls updateChannel) when the renamed name is all disallowed characters", async () => {
    const res = await PATCH(patchReq({ name: "   " }), ctx)
    expect(res.status).toBe(400)
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })
})
