import { SignJWT, jwtVerify } from "jose";
import { randomBytes, createHash } from "crypto";

const DEFAULT_SECRET = "alook-dev-secret-change-in-production";

export function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
  return new TextEncoder().encode(secret);
}

export async function signJWT(payload: {
  sub: string;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("72h")
    .sign(getJWTSecret());
}

export async function verifyJWT(
  token: string
): Promise<{ sub: string; email: string; name: string }> {
  const { payload } = await jwtVerify(token, getJWTSecret(), {
    algorithms: ["HS256"],
  });
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    name: payload.name as string,
  };
}

export function generateMachineToken(): string {
  const bytes = randomBytes(24);
  return "al_" + bytes.toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateVerificationCode(): string {
  const buf = randomBytes(4);
  const n = buf.readUInt32BE(0) % 1000000;
  return n.toString().padStart(6, "0");
}
