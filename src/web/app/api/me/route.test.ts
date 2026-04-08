import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/user");
vi.mock("@/lib/auth/jwt");
vi.mock("@/lib/db/queries/machine-token");

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => {
    return async (req: any) => {
      return handler(req, { userId: "u1", email: "user@test.com" });
    };
  }),
}));

vi.mock("@/lib/api/responses", () => ({
  userToResponse: vi.fn((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatar_url: u.avatarUrl || null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  })),
}));

import { getUser } from "@/lib/db/queries/user";
import { GET } from "./route";

const mockGetUser = vi.mocked(getUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/me", () => {
  it("returns user data when authenticated", async () => {
    mockGetUser.mockResolvedValue({
      id: "u1",
      name: "Alice",
      email: "user@test.com",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const req = new Request("http://localhost/api/me");
    const res = await GET(req as any);
    const body = await res.json();

    expect(body.id).toBe("u1");
    expect(body.name).toBe("Alice");
    expect(body.email).toBe("user@test.com");
    expect(body.avatar_url).toBeNull();
    expect(mockGetUser).toHaveBeenCalledWith(expect.anything(), "u1");
  });
});
