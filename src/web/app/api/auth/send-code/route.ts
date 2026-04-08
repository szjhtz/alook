import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  createVerificationCode,
  getLatestCodeByEmail,
  deleteExpiredVerificationCodes,
} from "@/lib/db/queries/verification-code";
import { generateVerificationCode } from "@/lib/auth/jwt";
import { EmailService } from "@/lib/services/email";
import { writeJSON, writeError } from "@/lib/middleware/helpers";

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return writeError("invalid request body", 400);
  }

  const email = (body.email || "").toLowerCase().trim();
  if (!email) {
    return writeError("email is required", 400);
  }

  const appEnv = process.env.APP_ENV || "development";
  if (appEnv !== "production") {
    console.log("dev mode: use code 888888");
    return writeJSON({ message: "Verification code sent" });
  }

  const latest = await getLatestCodeByEmail(db, email);
  if (latest) {
    const elapsed = Date.now() - new Date(latest.createdAt).getTime();
    if (elapsed < 10_000) {
      return writeError("please wait before requesting another code", 429);
    }
  }

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await createVerificationCode(db, { email, code, expiresAt });

  try {
    const emailService = new EmailService();
    await emailService.sendVerificationCode(email, code);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return writeError("failed to send verification email", 500);
  }

  deleteExpiredVerificationCodes(db).catch(() => {});

  return writeJSON({ message: "Verification code sent" });
}
