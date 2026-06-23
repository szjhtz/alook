import { describe, it, expect } from "vitest";
import {
  classifyRuntimeError,
  extractHttpStatus,
  scrubDiagnosticText,
} from "../errorDiagnostics.js";

describe("extractHttpStatus", () => {
  it("extracts from 'HTTP 429'", () => {
    expect(extractHttpStatus("HTTP 429 Too Many Requests")).toBe(429);
  });

  it("extracts from 'status: 401'", () => {
    expect(extractHttpStatus("status: 401")).toBe(401);
  });

  it("extracts from 'API Error: 500'", () => {
    expect(extractHttpStatus("API Error: 500")).toBe(500);
  });

  it("extracts from semantic '404 Not Found'", () => {
    expect(extractHttpStatus("404 Not Found")).toBe(404);
  });

  it("returns null for no status", () => {
    expect(extractHttpStatus("something went wrong")).toBeNull();
  });

  it("does not extract bare numbers without context", () => {
    expect(extractHttpStatus("processed 429 records")).toBeNull();
  });
});

describe("classifyRuntimeError", () => {
  it("explicit RateLimitError token → RateLimitError", () => {
    const r = classifyRuntimeError("RateLimitError: try again later");
    expect(r.errorClass).toBe("RateLimitError");
    expect(r.action).toBe("retry_backoff");
  });

  it("explicit AuthenticationError token → AuthError", () => {
    const r = classifyRuntimeError("AuthenticationError: invalid credentials");
    expect(r.errorClass).toBe("AuthError");
  });

  it("HTTP 429 → RateLimitError", () => {
    const r = classifyRuntimeError("HTTP 429 Too Many Requests");
    expect(r.errorClass).toBe("RateLimitError");
    expect(r.action).toBe("retry_backoff");
  });

  it("status: 401 → AuthError", () => {
    const r = classifyRuntimeError("status: 401 Unauthorized");
    expect(r.errorClass).toBe("AuthError");
    expect(r.action).toBe("abort");
  });

  it("HTTP 404 → NotFoundError", () => {
    const r = classifyRuntimeError("HTTP 404 Not Found");
    expect(r.errorClass).toBe("NotFoundError");
    expect(r.action).toBe("report");
  });

  it("HTTP 500 → ProviderServerError", () => {
    const r = classifyRuntimeError("HTTP 500 Internal Server Error");
    expect(r.errorClass).toBe("ProviderServerError");
    expect(r.action).toBe("retry");
  });

  it("rate limit text → RateLimitError", () => {
    const r = classifyRuntimeError("API rate limit exceeded, please slow down");
    expect(r.errorClass).toBe("RateLimitError");
  });

  it("overloaded → RateLimitError", () => {
    const r = classifyRuntimeError("Service overloaded, try again later");
    expect(r.errorClass).toBe("RateLimitError");
  });

  it("token revoked → AuthError (expanded pattern)", () => {
    const r = classifyRuntimeError("your token revoked by admin");
    expect(r.errorClass).toBe("AuthError");
  });

  it("refresh token expired → AuthError (expanded pattern)", () => {
    const r = classifyRuntimeError("refresh token expired, please re-authenticate");
    expect(r.errorClass).toBe("AuthError");
  });

  it("session expired → AuthError", () => {
    const r = classifyRuntimeError("Your session expired");
    expect(r.errorClass).toBe("AuthError");
  });

  it("credentials not found → AuthError", () => {
    const r = classifyRuntimeError("credentials not found in keychain");
    expect(r.errorClass).toBe("AuthError");
  });

  it("invalid api key → AuthError", () => {
    const r = classifyRuntimeError("Invalid API key provided");
    expect(r.errorClass).toBe("AuthError");
  });

  it("model not supported → ModelConfigError", () => {
    const r = classifyRuntimeError("model not supported: gpt-99");
    expect(r.errorClass).toBe("ModelConfigError");
    expect(r.action).toBe("abort");
  });

  it("ETIMEDOUT → TimeoutError", () => {
    const r = classifyRuntimeError("connect ETIMEDOUT 1.2.3.4:443");
    expect(r.errorClass).toBe("TimeoutError");
    expect(r.action).toBe("retry");
  });

  it("ECONNREFUSED → ProviderConnectionError", () => {
    const r = classifyRuntimeError("connect ECONNREFUSED 127.0.0.1:8080");
    expect(r.errorClass).toBe("ProviderConnectionError");
    expect(r.action).toBe("retry_jitter");
  });

  it("ECONNRESET → ProviderConnectionError", () => {
    const r = classifyRuntimeError("read ECONNRESET");
    expect(r.errorClass).toBe("ProviderConnectionError");
  });

  it("Unable to connect to API → ProviderConnectionError", () => {
    const r = classifyRuntimeError("Unable to connect to API endpoint");
    expect(r.errorClass).toBe("ProviderConnectionError");
  });

  it("unknown error → RuntimeError", () => {
    const r = classifyRuntimeError("something completely unknown happened");
    expect(r.errorClass).toBe("RuntimeError");
    expect(r.action).toBe("report");
  });

  it("httpStatus override via parameter", () => {
    const r = classifyRuntimeError("some generic message", 429);
    expect(r.errorClass).toBe("RateLimitError");
  });

  it("explicit token takes priority over HTTP status", () => {
    const r = classifyRuntimeError("TimeoutError: HTTP 429 rate limited", 429);
    expect(r.errorClass).toBe("TimeoutError");
  });
});

describe("scrubDiagnosticText", () => {
  it("redacts sk-ant tokens", () => {
    const result = scrubDiagnosticText("key=sk-ant-abc123-xyz789 failed");
    expect(result).toContain("sk-ant-***");
    expect(result).not.toContain("abc123");
  });

  it("redacts sk-proj tokens", () => {
    const result = scrubDiagnosticText("token: sk-proj-longtoken123");
    expect(result).toContain("sk-proj-***");
    expect(result).not.toContain("longtoken123");
  });

  it("redacts Bearer tokens", () => {
    const result = scrubDiagnosticText("Authorization: Bearer eyJhbGciOiJIUzI1Ni.token");
    expect(result).toContain("Bearer ***");
    expect(result).not.toContain("eyJhbGciOiJIUzI1Ni");
  });

  it("redacts email addresses", () => {
    const result = scrubDiagnosticText("user john@example.com failed");
    expect(result).toContain("***@***.***");
    expect(result).not.toContain("john@example.com");
  });

  it("redacts URL credentials", () => {
    const result = scrubDiagnosticText("https://admin:secret@host.com/api");
    expect(result).toContain("://***:***@");
    expect(result).not.toContain("admin:secret");
  });

  it("redacts home directory paths", () => {
    const result = scrubDiagnosticText("file at /Users/john/.config/app.json");
    expect(result).toContain("/***");
    expect(result).not.toContain("/Users/john");
  });
});
