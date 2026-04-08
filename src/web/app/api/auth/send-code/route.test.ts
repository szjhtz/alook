import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/queries/verification-code");
vi.mock("@/lib/auth/jwt");
vi.mock("@/lib/services/email");

import {
  createVerificationCode,
  getLatestCodeByEmail,
  deleteExpiredVerificationCodes,
} from "@/lib/db/queries/verification-code";
import { generateVerificationCode } from "@/lib/auth/jwt";
import { EmailService } from "@/lib/services/email";
import { POST } from "./route";

const mockGetLatest = vi.mocked(getLatestCodeByEmail);
const mockCreate = vi.mocked(createVerificationCode);
const mockGenerate = vi.mocked(generateVerificationCode);
const mockDelete = vi.mocked(deleteExpiredVerificationCodes);

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.APP_ENV;
});

describe("POST /api/auth/send-code", () => {
  it("returns 400 for missing email", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("email is required");
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns dev-mode message in non-production", async () => {
    const res = await POST(makeReq({ email: "test@test.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Verification code sent");
  });

  it("returns 429 when rate limited in production", async () => {
    process.env.APP_ENV = "production";
    mockGetLatest.mockResolvedValue({
      createdAt: new Date(),
    } as any);

    const res = await POST(makeReq({ email: "test@test.com" }));
    expect(res.status).toBe(429);
  });

  it("sends code and returns success in production", async () => {
    process.env.APP_ENV = "production";
    mockGetLatest.mockResolvedValue(null as any);
    mockGenerate.mockReturnValue("123456");
    mockCreate.mockResolvedValue(undefined as any);
    mockDelete.mockResolvedValue(undefined as any);
    (EmailService as any).mockImplementation(() => ({
      sendVerificationCode: vi.fn().mockResolvedValue(undefined),
    }));

    const res = await POST(makeReq({ email: "test@test.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Verification code sent");
  });

  it("returns 500 when email service fails in production", async () => {
    process.env.APP_ENV = "production";
    mockGetLatest.mockResolvedValue(null as any);
    mockGenerate.mockReturnValue("123456");
    mockCreate.mockResolvedValue(undefined as any);
    (EmailService as any).mockImplementation(() => ({
      sendVerificationCode: vi.fn().mockRejectedValue(new Error("send failed")),
    }));

    const res = await POST(makeReq({ email: "test@test.com" }));
    expect(res.status).toBe(500);
  });
});
