import { eq, and, desc } from "drizzle-orm";
import { conversation } from "../schema";
import type { Database } from "../index";

export async function createConversation(
  db: Database,
  data: {
    workspaceId: string;
    agentId: string;
    userId: string;
    title: string;
  }
) {
  const rows = await db
    .insert(conversation)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      userId: data.userId,
      title: data.title,
    })
    .returning();
  return rows[0]!;
}

export async function getConversation(db: Database, id: string) {
  const rows = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, id));
  return rows[0] ?? null;
}

export async function listConversations(
  db: Database,
  workspaceId: string,
  userId: string
) {
  return db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.workspaceId, workspaceId),
        eq(conversation.userId, userId)
      )
    )
    .orderBy(desc(conversation.createdAt));
}
