import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/member");

import { getMemberByUserAndWorkspace } from "@/lib/db/queries/member";
import { withWorkspaceMember } from "./workspace";

const mockGetMember = vi.mocked(getMemberByUserAndWorkspace);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReq(url = "http://localhost/api/test") {
  return new NextRequest(url);
}

const auth = { userId: "u1", email: "a@b.com" };

describe("withWorkspaceMember", () => {
  it("returns workspaceId from query param", async () => {
    mockGetMember.mockResolvedValue({ id: "m1" } as any);
    const result = await withWorkspaceMember(
      makeReq("http://localhost/api/test?workspace_id=w1"),
      auth,
    );
    expect(result).toEqual({ workspaceId: "w1" });
  });

  it("returns workspaceId from X-Workspace-ID header", async () => {
    mockGetMember.mockResolvedValue({ id: "m1" } as any);
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "X-Workspace-ID": "w2" },
    });
    const result = await withWorkspaceMember(req, auth);
    expect(result).toEqual({ workspaceId: "w2" });
  });

  it("returns workspaceId from auth context (machine token)", async () => {
    mockGetMember.mockResolvedValue({ id: "m1" } as any);
    const result = await withWorkspaceMember(
      makeReq(),
      { ...auth, workspaceId: "w3" },
    );
    expect(result).toEqual({ workspaceId: "w3" });
  });

  it("returns 400 when no workspace_id provided", async () => {
    const result = await withWorkspaceMember(makeReq(), auth);
    expect((result as any).status).toBe(400);
  });

  it("returns 404 when user is not a member", async () => {
    mockGetMember.mockResolvedValue(null as any);
    const result = await withWorkspaceMember(
      makeReq("http://localhost/api/test?workspace_id=w1"),
      auth,
    );
    expect((result as any).status).toBe(404);
  });

  it("returns 401 when userId is missing", async () => {
    const result = await withWorkspaceMember(
      makeReq("http://localhost/api/test?workspace_id=w1"),
      { userId: "", email: "" },
    );
    expect((result as any).status).toBe(401);
  });
});
