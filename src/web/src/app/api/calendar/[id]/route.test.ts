import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@alook/shared", async () => {
  const actual = await vi.importActual<typeof import("@alook/shared")>("@alook/shared");
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
    queries: {
      calendarEvent: {
        getCalendarEvent: (...a: unknown[]) => mockGet(...a),
        deleteCalendarEvent: (...a: unknown[]) => mockDelete(...a),
        updateCalendarEvent: (...a: unknown[]) => mockUpdate(...a),
        createCalendarEvent: (...a: unknown[]) => mockCreate(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
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
  calendarEventToResponse: (e: any) => ({ id: e.id, ...e }),
}));

import { DELETE, PATCH, GET } from "./route";

function req(id: string | undefined, body: unknown) {
  const r = new NextRequest(`http://localhost/api/calendar/${id ?? ""}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return PATCH(r, { params: { id } } as any);
}

describe("GET /api/calendar/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 + the event body when it exists in the workspace", async () => {
    mockGet.mockResolvedValue({
      id: "ce_1",
      agentId: "ag_1",
      workspaceId: "ws1",
      title: "standup",
    });
    const r = new NextRequest("http://localhost/api/calendar/ce_1", {
      method: "GET",
    });
    const res = await GET(r, { params: { id: "ce_1" } } as any);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("ce_1");
    expect(mockGet).toHaveBeenCalledWith({}, "ce_1", "ws1");
  });

  it("returns 404 when the event is not in the caller's workspace", async () => {
    mockGet.mockResolvedValue(null);
    const r = new NextRequest("http://localhost/api/calendar/ce_missing", {
      method: "GET",
    });
    const res = await GET(r, { params: { id: "ce_missing" } } as any);
    expect(res.status).toBe(404);
  });

  it("returns 400 when id is missing", async () => {
    const r = new NextRequest("http://localhost/api/calendar/", {
      method: "GET",
    });
    const res = await GET(r, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/calendar/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when the event does not exist in the workspace", async () => {
    mockDelete.mockResolvedValue(null);
    const r = new NextRequest("http://localhost/api/calendar/ce_missing", {
      method: "DELETE",
    });
    const res = await DELETE(r, { params: { id: "ce_missing" } } as any);
    expect(res.status).toBe(404);
    expect(mockDelete).toHaveBeenCalledWith({}, "ce_missing", "ws1");
  });

  it("returns the deleted event when successful", async () => {
    mockDelete.mockResolvedValue({ id: "ce_1" });
    const r = new NextRequest("http://localhost/api/calendar/ce_1", {
      method: "DELETE",
    });
    const res = await DELETE(r, { params: { id: "ce_1" } } as any);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("ce_1");
  });

  it("400s when id is missing", async () => {
    const r = new NextRequest("http://localhost/api/calendar/", {
      method: "DELETE",
    });
    const res = await DELETE(r, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

function sourceNonRepeating(overrides: Record<string, unknown> = {}) {
  return {
    id: "ce_1",
    agentId: "ag_1",
    workspaceId: "ws1",
    title: "standup",
    description: null,
    scheduledAt: "2026-04-17T09:00:00.000Z",
    repeatInterval: null,
    repeatStopAt: null,
    lastTriggeredAt: null,
    ...overrides,
  };
}

function sourceDaily(overrides: Record<string, unknown> = {}) {
  return {
    ...sourceNonRepeating(),
    repeatInterval: "1day",
    repeatStopAt: null,
    ...overrides,
  };
}

describe("PATCH /api/calendar/[id] — basics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when the event does not exist in the workspace", async () => {
    mockGet.mockResolvedValue(null);
    const res = await req("ce_missing", { title: "new" });
    expect(res.status).toBe(404);
  });

  it("400s on an empty patch body", async () => {
    const res = await req("ce_1", {});
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("400s when the title is an empty string", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    const res = await req("ce_1", { title: "" });
    expect(res.status).toBe(400);
  });

  it("400s when id is missing", async () => {
    const res = await req(undefined, { title: "t" });
    expect(res.status).toBe(400);
  });

  it("200s + returns the updated body on a successful title+description update", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    mockUpdate.mockResolvedValue({
      id: "ce_1",
      title: "new",
      description: "<p>desc</p>",
    });
    const res = await req("ce_1", { title: "new", description: "<p>desc</p>" });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({}, "ce_1", "ws1", {
      title: "new",
      description: "<p>desc</p>",
    });
  });

  it("normalizes empty-HTML description to null before reaching the query", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    mockUpdate.mockResolvedValue({ id: "ce_1", description: null });
    await req("ce_1", { description: "<p></p>" });
    expect(mockUpdate.mock.calls[0][3]).toEqual({ description: null });
  });

  it("passes description: null through as a clearing op", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    mockUpdate.mockResolvedValue({ id: "ce_1", description: null });
    await req("ce_1", { description: null });
    expect(mockUpdate.mock.calls[0][3]).toEqual({ description: null });
  });
});

describe("PATCH /api/calendar/[id] — full fields", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when agent_id is not in the workspace", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    mockGetAgent.mockResolvedValue(null);
    const res = await req("ce_1", { agent_id: "ag_missing" });
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates agent + scheduled_at in place on a non-repeating event", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    mockGetAgent.mockResolvedValue({ id: "ag_2" });
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    const res = await req("ce_1", {
      agent_id: "ag_2",
      scheduled_at: "2026-04-18T10:00:00.000Z",
    });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({}, "ce_1", "ws1", {
      agentId: "ag_2",
      scheduledAt: "2026-04-18T10:00:00.000Z",
    });
  });

  it("converts repeat_stop_date → repeat_stop_at (ISO end-of-day)", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    await req("ce_1", { repeat_stop_date: "2026-05-01" });
    const patch = mockUpdate.mock.calls[0][3];
    expect(patch.repeatStopAt).toMatch(/2026-05-0[12]T/);
  });

  it("passes repeat_interval: null and repeat_stop_date: null through as clears", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    await req("ce_1", { repeat_interval: null, repeat_stop_date: null });
    expect(mockUpdate.mock.calls[0][3]).toEqual({
      repeatInterval: null,
      repeatStopAt: null,
    });
  });

  it("scope=this on a non-repeating event is treated as in-place", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    await req("ce_1", { title: "new", scope: "this" });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("scope=following on a repeating event is in-place", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    await req("ce_1", { title: "renamed", scope: "following" });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][3]).toEqual({ title: "renamed" });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/calendar/[id] — scope=this split", () => {
  beforeEach(() => vi.clearAllMocks());

  it("advances the parent's scheduled_at and inserts a detached one-off", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    mockCreate.mockImplementation((_db, data) => ({
      id: "ce_2",
      ...data,
    }));
    const res = await req("ce_1", {
      title: "just this one",
      scope: "this",
    });
    expect(res.status).toBe(200);

    // Parent advanced by 1 day
    expect(mockUpdate).toHaveBeenCalledWith({}, "ce_1", "ws1", {
      scheduledAt: "2026-04-18T09:00:00.000Z",
    });
    // Detached one-off created with patch applied and no repeat
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const detached = mockCreate.mock.calls[0][1];
    expect(detached.workspaceId).toBe("ws1");
    expect(detached.agentId).toBe("ag_1");
    expect(detached.title).toBe("just this one");
    expect(detached.scheduledAt).toBe("2026-04-17T09:00:00.000Z");
    expect(detached.repeatInterval).toBeNull();
    expect(detached.repeatStopAt).toBeNull();

    // Returns the detached event
    const body = await res.json();
    expect(body.id).toBe("ce_2");
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("applies the edited scheduled_at to the detached event (not the parent)", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    mockCreate.mockImplementation((_db, data) => ({ id: "ce_2", ...data }));
    await req("ce_1", {
      scheduled_at: "2026-04-17T11:30:00.000Z",
      scope: "this",
    });
    // Parent still advances to next occurrence of the ORIGINAL schedule
    expect(mockUpdate.mock.calls[0][3]).toEqual({
      scheduledAt: "2026-04-18T09:00:00.000Z",
    });
    // Detached uses the user-supplied time
    expect(mockCreate.mock.calls[0][1].scheduledAt).toBe(
      "2026-04-17T11:30:00.000Z"
    );
  });

  it("deletes the parent when the series ends at this occurrence", async () => {
    mockGet.mockResolvedValue(
      sourceDaily({
        scheduledAt: "2026-04-17T09:00:00.000Z",
        repeatStopAt: "2026-04-17T23:59:59.999Z",
      })
    );
    mockCreate.mockImplementation((_db, data) => ({ id: "ce_2", ...data }));
    const res = await req("ce_1", { title: "final", scope: "this" });
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({}, "ce_1", "ws1");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1].title).toBe("final");
  });

  it("validates agent_id in the workspace even on the split path", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockGetAgent.mockResolvedValue(null);
    const res = await req("ce_1", { agent_id: "ag_nope", scope: "this" });
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/calendar/[id] — scope=this on a future occurrence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds occurrence_at to the parent's exceptions; does NOT advance parent", async () => {
    mockGet.mockResolvedValue(
      sourceDaily({ exceptions: [] })
    );
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    mockCreate.mockImplementation((_db, data) => ({ id: "ce_2", ...data }));

    const res = await req("ce_1", {
      title: "renamed future",
      scope: "this",
      occurrence_at: "2026-04-20T09:00:00.000Z",
    });
    expect(res.status).toBe(200);

    // Parent updated with exceptions, NOT scheduledAt
    expect(mockUpdate).toHaveBeenCalledWith({}, "ce_1", "ws1", {
      exceptions: ["2026-04-20T09:00:00.000Z"],
    });
    // Detached one-off uses the occurrence_at as scheduledAt
    expect(mockCreate.mock.calls[0][1].scheduledAt).toBe(
      "2026-04-20T09:00:00.000Z"
    );
    expect(mockCreate.mock.calls[0][1].title).toBe("renamed future");
  });

  it("does not duplicate the exception when it's already recorded", async () => {
    mockGet.mockResolvedValue(
      sourceDaily({ exceptions: ["2026-04-20T09:00:00.000Z"] })
    );
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    mockCreate.mockImplementation((_db, data) => ({ id: "ce_2", ...data }));
    await req("ce_1", {
      title: "x",
      scope: "this",
      occurrence_at: "2026-04-20T09:00:00.000Z",
    });
    expect(mockUpdate.mock.calls[0][3].exceptions).toEqual([
      "2026-04-20T09:00:00.000Z",
    ]);
  });

  it("uses the edited scheduled_at on the detached event when provided", async () => {
    mockGet.mockResolvedValue(sourceDaily());
    mockUpdate.mockResolvedValue({ id: "ce_1" });
    mockCreate.mockImplementation((_db, data) => ({ id: "ce_2", ...data }));
    await req("ce_1", {
      scheduled_at: "2026-04-20T10:30:00.000Z",
      scope: "this",
      occurrence_at: "2026-04-20T09:00:00.000Z",
    });
    expect(mockCreate.mock.calls[0][1].scheduledAt).toBe(
      "2026-04-20T10:30:00.000Z"
    );
  });
});

describe("GET /api/calendar/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s when the event does not exist", async () => {
    mockGet.mockResolvedValue(null);
    const r = new NextRequest("http://localhost/api/calendar/ce_x");
    const res = await GET(r, { params: { id: "ce_x" } } as any);
    expect(res.status).toBe(404);
  });

  it("returns the event when found", async () => {
    mockGet.mockResolvedValue(sourceNonRepeating());
    const r = new NextRequest("http://localhost/api/calendar/ce_1");
    const res = await GET(r, { params: { id: "ce_1" } } as any);
    expect(res.status).toBe(200);
  });
});
