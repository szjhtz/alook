import { eq, and, desc } from "drizzle-orm";
import { machineToken, user } from "../schema";
import type { Database } from "../index";

export async function createMachineToken(
  db: Database,
  data: {
    userId: string;
    workspaceId: string;
    tokenHash: string;
    name: string;
  }
) {
  const rows = await db
    .insert(machineToken)
    .values({
      userId: data.userId,
      workspaceId: data.workspaceId,
      tokenHash: data.tokenHash,
      name: data.name,
    })
    .returning();
  return rows[0]!;
}

export async function getMachineTokenByHash(db: Database, tokenHash: string) {
  const rows = await db
    .select({
      id: machineToken.id,
      userId: machineToken.userId,
      workspaceId: machineToken.workspaceId,
      tokenHash: machineToken.tokenHash,
      name: machineToken.name,
      lastUsedAt: machineToken.lastUsedAt,
      createdAt: machineToken.createdAt,
      userEmail: user.email,
    })
    .from(machineToken)
    .innerJoin(user, eq(user.id, machineToken.userId))
    .where(eq(machineToken.tokenHash, tokenHash));
  return rows[0] ?? null;
}

export async function listMachineTokens(
  db: Database,
  userId: string,
  workspaceId: string
) {
  return db
    .select()
    .from(machineToken)
    .where(
      and(
        eq(machineToken.userId, userId),
        eq(machineToken.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(machineToken.createdAt));
}

export async function deleteMachineToken(
  db: Database,
  id: string,
  userId: string
) {
  await db
    .delete(machineToken)
    .where(and(eq(machineToken.id, id), eq(machineToken.userId, userId)));
}

export async function updateMachineTokenLastUsed(db: Database, id: string) {
  await db
    .update(machineToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(machineToken.id, id));
}
