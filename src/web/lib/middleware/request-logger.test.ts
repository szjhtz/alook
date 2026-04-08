import { describe, it, expect, vi, beforeEach } from "vitest";
import { logRequest } from "./request-logger";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("logRequest", () => {
  it("logs info for 2xx status", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logRequest("GET", "/api/agents", 200, 15);
    expect(spy).toHaveBeenCalledWith("http request", expect.objectContaining({
      method: "GET",
      path: "/api/agents",
      status: 200,
    }));
  });

  it("logs warn for 4xx status", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logRequest("POST", "/api/agents", 400, 5);
    expect(spy).toHaveBeenCalledWith("http request", expect.objectContaining({
      status: 400,
    }));
  });

  it("logs error for 5xx status", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logRequest("GET", "/api/agents", 500, 100);
    expect(spy).toHaveBeenCalledWith("http request", expect.objectContaining({
      status: 500,
    }));
  });

  it("skips /health endpoint", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logRequest("GET", "/health", 200, 1);
    logRequest("GET", "/api/health", 200, 1);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("includes requestId and userId when provided", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logRequest("GET", "/api/test", 200, 10, "req-1", "u1");
    expect(spy).toHaveBeenCalledWith("http request", expect.objectContaining({
      request_id: "req-1",
      user_id: "u1",
    }));
  });
});
