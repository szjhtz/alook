import { describe, it, expect, afterAll } from "vitest";
import { createHealthServer } from "./health.js";

const TEST_PORT = 19614;
const healthUrl = `http://127.0.0.1:${TEST_PORT}`;

const { server, setRuntimeCount } = createHealthServer(TEST_PORT);

afterAll(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

describe("health server", () => {
  it("binds to 127.0.0.1", () => {
    const addr = server.address();
    expect(addr).not.toBeNull();
    if (typeof addr === "object" && addr) {
      expect(addr.address).toBe("127.0.0.1");
    }
  });

  it("GET /health returns status ok with uptime and runtimes", async () => {
    const res = await fetch(`${healthUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.uptime).toMatch(/^\d+s$/);
    expect(body.runtimes).toBe(0);
  });

  it("setRuntimeCount updates the runtimes count", async () => {
    setRuntimeCount(5);

    const res = await fetch(`${healthUrl}/health`);
    const body = await res.json();
    expect(body.runtimes).toBe(5);
  });

  it("non-health paths return 404", async () => {
    const res = await fetch(`${healthUrl}/other`);
    expect(res.status).toBe(404);
  });
});
