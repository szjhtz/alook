import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns { status: 'ok' }", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("responds with status code 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
