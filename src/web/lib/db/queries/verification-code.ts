import { eq, and, sql, desc } from "drizzle-orm";
import { verificationCode } from "../schema";
import type { Database } from "../index";

export async function createVerificationCode(
  db: Database,
  data: { email: string; code: string; expiresAt: Date }
) {
  const rows = await db
    .insert(verificationCode)
    .values({
      email: data.email,
      code: data.code,
      expiresAt: data.expiresAt,
    })
    .returning();
  return rows[0]!;
}

export async function getLatestVerificationCode(
  db: Database,
  email: string
) {
  const rows = await db
    .select()
    .from(verificationCode)
    .where(
      and(
        eq(verificationCode.email, email),
        eq(verificationCode.used, false),
        sql`${verificationCode.expiresAt} > now()`,
        sql`${verificationCode.attempts} < 5`
      )
    )
    .orderBy(desc(verificationCode.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function markVerificationCodeUsed(db: Database, id: string) {
  await db
    .update(verificationCode)
    .set({ used: true })
    .where(eq(verificationCode.id, id));
}

export async function incrementVerificationCodeAttempts(
  db: Database,
  id: string
) {
  await db
    .update(verificationCode)
    .set({ attempts: sql`${verificationCode.attempts} + 1` })
    .where(eq(verificationCode.id, id));
}

export async function getLatestCodeByEmail(db: Database, email: string) {
  const rows = await db
    .select()
    .from(verificationCode)
    .where(eq(verificationCode.email, email))
    .orderBy(desc(verificationCode.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteExpiredVerificationCodes(db: Database) {
  await db
    .delete(verificationCode)
    .where(sql`${verificationCode.expiresAt} < now()`);
}
