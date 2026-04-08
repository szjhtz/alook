import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({}) },
  })),
}));

import { EmailService } from "./email";
import { Resend } from "resend";

const MockResend = vi.mocked(Resend);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

describe("EmailService", () => {
  it("logs to console when RESEND_API_KEY is not set", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const svc = new EmailService();
    await svc.sendVerificationCode("user@test.com", "123456");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Verification code for user@test.com: 123456")
    );
    expect(MockResend).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("uses default fromEmail noreply@alook.ai", () => {
    process.env.RESEND_API_KEY = "re_test_key";

    const svc = new EmailService();
    expect(MockResend).toHaveBeenCalledWith("re_test_key");

    const mockInstance = MockResend.mock.results[0].value;
    svc.sendVerificationCode("user@test.com", "123456");

    expect(mockInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "noreply@alook.ai" })
    );
  });

  it("RESEND_FROM_EMAIL overrides default", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "custom@example.com";

    const svc = new EmailService();
    const mockInstance = MockResend.mock.results[0].value;
    svc.sendVerificationCode("user@test.com", "123456");

    expect(mockInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: "custom@example.com" })
    );
  });
});
