import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { queries } from "@alook/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext();
  const db = getDb((env as Env).DB);

  const traceId = ctx.params?.traceId;
  if (!traceId || typeof traceId !== "string" || !traceId.startsWith("tr_") || traceId.length > 30) {
    return writeError("invalid traceId", 400);
  }

  const tasks = await queries.task.getTraceTree(db, traceId, ws.workspaceId);
  if (tasks.length === 0) return writeError("trace not found", 404);

  const agents = await queries.agent.listAgents(db, ws.workspaceId, ctx.userId);
  const agentMap = new Map(agents.map(a => [a.id, { name: a.name, email_handle: a.emailHandle, avatarUrl: a.avatarUrl }]));

  const traceTasks = tasks.map(t => ({
    id: t.id,
    agent_id: t.agentId,
    agent: agentMap.get(t.agentId) ?? null,
    parent_task_id: t.parentTaskId,
    prompt: t.prompt,
    status: t.status,
    type: t.type,
    conversation_id: t.conversationId,
    created_at: t.createdAt,
    completed_at: t.completedAt,
  }));

  return writeJSON({ trace_id: traceId, tasks: traceTasks });
});
