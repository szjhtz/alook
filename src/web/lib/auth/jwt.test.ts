import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT, jwtVerify, decodeJwt, decodeProtectedHeader } from "jose";
import {
  getJWTSecret,
  signJWT,
  verifyJWT,
  generateMachineToken,
  hashToken,
  generateVerificationCode,
} from "./jwt";

describe("JWT token generation and verification", () => {
  const claims = { sub: "user-1", email: "a@b.com", name: "Alice" };

  it("sign then verify returns the same claims", async () => {
    const token = await signJWT(claims);
    const result = await verifyJWT(token);
    expect(result).toEqual(claims);
  });

  it("sets HS256 algorithm in the protected header", async () => {
    const token = await signJWT(claims);
    const header = decodeProtectedHeader(token);
    expect((await header).alg).toBe("HS256");
  });

  it("sets expiration to 72 hours", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(claims);
    const decoded = decodeJwt(token);
    const diff = decoded.exp! - now;
    const seventyTwoHours = 72 * 60 * 60;
    expect(diff).toBeGreaterThanOrEqual(seventyTwoHours - 5);
    expect(diff).toBeLessThanOrEqual(seventyTwoHours + 5);
  });

  it("includes iat claim", async () => {
    const token = await signJWT(claims);
    const decoded = decodeJwt(token);
    expect(decoded.iat).toBeDefined();
    expect(typeof decoded.iat).toBe("number");
  });

  it("rejects tokens signed with a different secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("72h")
      .sign(wrongSecret);

    await expect(verifyJWT(token)).rejects.toThrow();
  });

  it("rejects expired tokens", async () => {
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("-1s")
      .sign(getJWTSecret());

    await expect(verifyJWT(token)).rejects.toThrow();
  });
});

describe("JWT secret handling", () => {
  const original = process.env.JWT_SECRET;

  afterEach(() => {
    if (original !== undefined) {
      process.env.JWT_SECRET = original;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it("uses JWT_SECRET env var when set", () => {
    process.env.JWT_SECRET = "my-custom-secret";
    const secret = getJWTSecret();
    expect(secret).toEqual(new TextEncoder().encode("my-custom-secret"));
  });

  it("falls back to default secret when JWT_SECRET is not set", () => {
    delete process.env.JWT_SECRET;
    const secret = getJWTSecret();
    expect(secret).toEqual(
      new TextEncoder().encode("alook-dev-secret-change-in-production")
    );
  });
});

describe("Machine token authentication", () => {
  it("returns a string starting with 'al_'", () => {
    expect(generateMachineToken().startsWith("al_")).toBe(true);
  });

  it("has correct length (3 prefix + 48 hex = 51)", () => {
    expect(generateMachineToken()).toHaveLength(51);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateMachineToken()));
    expect(tokens.size).toBe(20);
  });

  it("hashToken returns consistent SHA-256 hex digest", () => {
    const input = "al_abc123";
    expect(hashToken(input)).toBe(hashToken(input));
    expect(hashToken(input)).toHaveLength(64);
  });

  it("hashToken produces different outputs for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });
});

describe("Verification code generation", () => {
  it("returns a 6-character string", () => {
    expect(generateVerificationCode()).toHaveLength(6);
  });

  it("zero-pads small numbers", () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("is always between '000000' and '999999'", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode();
      const n = parseInt(code, 10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  it("generates different codes across multiple calls (high probability)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateVerificationCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
