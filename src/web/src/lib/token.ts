import { randomBytes, createHash } from "crypto";

export function generateMachineToken(): string {
  const bytes = randomBytes(24);
  return "al_" + bytes.toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
