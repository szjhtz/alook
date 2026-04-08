import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { agentTaskQueue } from "../schema";
import type { Database } from "../index";
import { ClaimedTaskRowSchema } from "@alook/shared";

export async function createTask(
  db: Database,
  data: {
    agentId: string;
    runtimeId: string;
    workspaceId: string;
    conversationId: string;
    prompt: string;
    priority?: number;
  }
) {
  const rows = await db
    .insert(agentTaskQueue)
    .values({
      agentId: data.agentId,
      runtimeId: data.runtimeId,
      workspaceId: data.workspaceId,
      conversationId: data.conversationId,
      prompt: data.prompt,
      priority: data.priority ?? 0,
    })
    .returning();
  return rows[0]!;
}

export async function getTask(db: Database, id: string) {
  const rows = await db
    .select()
    .from(agentTaskQueue)
    .where(eq(agentTaskQueue.id, id));
  return rows[0] ?? null;
}

export async function getTaskStatus(db: Database, id: string) {
  const rows = await db
    .select({ status: agentTaskQueue.status })
    .from(agentTaskQueue)
    .where(eq(agentTaskQueue.id, id));
  return rows[0]?.status ?? null;
}

export async function claimTask(db: Database, agentId: string) {
  const candidates = await db
    .select({ id: agentTaskQueue.id })
    .from(agentTaskQueue)
    .where(
      and(
        eq(agentTaskQueue.agentId, agentId),
        eq(agentTaskQueue.status, "queued"),
        sql`NOT EXISTS (
          SELECT 1 FROM agent_task_queue active
          WHERE active.conversation_id = ${agentTaskQueue.conversationId}
            AND active.status IN ('dispatched', 'running')
            AND active.id != ${agentTaskQueue.id}
        )`
      )
    )
    .orderBy(desc(agentTaskQueue.priority), asc(agentTaskQueue.createdAt))
    .limit(1)
    .for("update", { skipLocked: true });

  if (candidates.length === 0) return null;

  const rows = await db
    .update(agentTaskQueue)
    .set({ status: "dispatched", dispatchedAt: new Date() })
    .where(
      and(
        eq(agentTaskQueue.id, candidates[0].id),
        eq(agentTaskQueue.status, "queued")
      )
    )
    .returning();

  const row = rows[0] ?? null;
  if (!row) return null;
  return ClaimedTaskRowSchema.parse(row);
}

export async function startTask(db: Database, id: string) {
  const rows = await db
    .update(agentTaskQueue)
    .set({ status: "running", startedAt: new Date() })
    .where(
      and(eq(agentTaskQueue.id, id), eq(agentTaskQueue.status, "dispatched"))
    )
    .returning();
  return rows[0] ?? null;
}

export async function completeTask(
  db: Database,
  id: string,
  data: { result: unknown; sessionId: string | null; workDir: string | null }
) {
  const rows = await db
    .update(agentTaskQueue)
    .set({
      status: "completed",
      completedAt: new Date(),
      result: data.result,
      sessionId: data.sessionId,
      workDir: data.workDir,
    })
    .where(
      and(eq(agentTaskQueue.id, id), eq(agentTaskQueue.status, "running"))
    )
    .returning();
  return rows[0] ?? null;
}

export async function failTask(
  db: Database,
  id: string,
  error: string
) {
  const rows = await db
    .update(agentTaskQueue)
    .set({ status: "failed", completedAt: new Date(), error })
    .where(
      and(
        eq(agentTaskQueue.id, id),
        inArray(agentTaskQueue.status, ["dispatched", "running"])
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function getLastTaskSession(
  db: Database,
  agentId: string,
  conversationId: string
) {
  const rows = await db
    .select({
      sessionId: agentTaskQueue.sessionId,
      workDir: agentTaskQueue.workDir,
    })
    .from(agentTaskQueue)
    .where(
      and(
        eq(agentTaskQueue.agentId, agentId),
        eq(agentTaskQueue.conversationId, conversationId),
        eq(agentTaskQueue.status, "completed"),
        sql`${agentTaskQueue.sessionId} IS NOT NULL`
      )
    )
    .orderBy(desc(agentTaskQueue.completedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listPendingTasksByRuntime(
  db: Database,
  runtimeId: string
) {
  return db
    .select()
    .from(agentTaskQueue)
    .where(
      and(
        eq(agentTaskQueue.runtimeId, runtimeId),
        inArray(agentTaskQueue.status, ["queued", "dispatched"])
      )
    )
    .orderBy(desc(agentTaskQueue.priority), asc(agentTaskQueue.createdAt));
}

export async function hasPendingTaskForConversation(
  db: Database,
  conversationId: string
) {
  const rows = await db
    .select({ exists: sql<boolean>`EXISTS(
      SELECT 1 FROM agent_task_queue
      WHERE conversation_id = ${conversationId}
        AND status IN ('queued', 'dispatched')
    )` })
    .from(sql`(SELECT 1) AS _dummy`);
  return rows[0]?.exists ?? false;
}

export async function cancelTask(db: Database, id: string) {
  const rows = await db
    .update(agentTaskQueue)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(
      and(
        eq(agentTaskQueue.id, id),
        inArray(agentTaskQueue.status, ["queued", "dispatched", "running"])
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function failStaleDispatchedTasks(db: Database, staleSeconds = 20) {
  const rows = await db
    .update(agentTaskQueue)
    .set({
      status: "failed",
      completedAt: new Date(),
      error: "timed out in dispatched state (daemon likely disconnected)",
    })
    .where(
      and(
        eq(agentTaskQueue.status, "dispatched"),
        sql`${agentTaskQueue.dispatchedAt} < now() - interval '${sql.raw(String(staleSeconds))} seconds'`
      )
    )
    .returning({ agentId: agentTaskQueue.agentId });
  return rows;
}

export async function countRunningTasks(db: Database, agentId: string) {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(agentTaskQueue)
    .where(
      and(
        eq(agentTaskQueue.agentId, agentId),
        inArray(agentTaskQueue.status, ["dispatched", "running"])
      )
    );
  return Number(rows[0]?.count ?? 0);
}
