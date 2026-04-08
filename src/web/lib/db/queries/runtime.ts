import { eq, and, asc, sql } from "drizzle-orm";
import { agentRuntime } from "../schema";
import type { Database } from "../index";

export async function upsertAgentRuntime(
  db: Database,
  data: {
    workspaceId: string;
    daemonId: string;
    name: string;
    runtimeMode: string;
    provider: string;
    status: string;
    deviceInfo: string;
    metadata?: unknown;
  }
) {
  const rows = await db
    .insert(agentRuntime)
    .values({
      workspaceId: data.workspaceId,
      daemonId: data.daemonId,
      name: data.name,
      runtimeMode: data.runtimeMode,
      provider: data.provider,
      status: data.status,
      deviceInfo: data.deviceInfo,
      metadata: data.metadata ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        agentRuntime.workspaceId,
        agentRuntime.daemonId,
        agentRuntime.provider,
      ],
      set: {
        name: sql`excluded.name`,
        runtimeMode: sql`excluded.runtime_mode`,
        status: sql`excluded.status`,
        deviceInfo: sql`excluded.device_info`,
        metadata: sql`excluded.metadata`,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0]!;
}

export async function listAgentRuntimes(db: Database, workspaceId: string) {
  return db
    .select()
    .from(agentRuntime)
    .where(eq(agentRuntime.workspaceId, workspaceId))
    .orderBy(asc(agentRuntime.createdAt));
}

export async function getAgentRuntime(db: Database, id: string) {
  const rows = await db
    .select()
    .from(agentRuntime)
    .where(eq(agentRuntime.id, id));
  return rows[0] ?? null;
}

export async function getAgentRuntimeForWorkspace(
  db: Database,
  id: string,
  workspaceId: string
) {
  const rows = await db
    .select()
    .from(agentRuntime)
    .where(
      and(eq(agentRuntime.id, id), eq(agentRuntime.workspaceId, workspaceId))
    );
  return rows[0] ?? null;
}

export async function updateAgentRuntimeHeartbeat(db: Database, id: string) {
  const rows = await db
    .update(agentRuntime)
    .set({ lastSeenAt: new Date(), status: "online", updatedAt: new Date() })
    .where(eq(agentRuntime.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function setAgentRuntimeOffline(db: Database, id: string) {
  await db
    .update(agentRuntime)
    .set({ status: "offline", updatedAt: new Date() })
    .where(eq(agentRuntime.id, id));
}

export async function markStaleRuntimesOffline(db: Database) {
  await db
    .update(agentRuntime)
    .set({ status: "offline", updatedAt: new Date() })
    .where(
      and(
        eq(agentRuntime.status, "online"),
        sql`${agentRuntime.lastSeenAt} < now() - interval '2 minutes'`
      )
    );
}
