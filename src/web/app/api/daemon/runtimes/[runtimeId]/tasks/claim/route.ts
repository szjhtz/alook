import { db } from "@/lib/db";
import { getAgent } from "@/lib/db/queries/agent";
import { getLastTaskSession } from "@/lib/db/queries/task";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { taskToResponse } from "@/lib/api/responses";
import { TaskService } from "@/lib/services/task";

export const POST = withAuth(async (_req, ctx) => {
  const runtimeId = ctx.params?.runtimeId;
  if (!runtimeId) {
    return writeError("runtime_id is required", 400);
  }

  const taskService = new TaskService(db);
  const task = await taskService.claimTaskForRuntime(runtimeId);

  if (!task) {
    return writeJSON({ task: null });
  }

  const agent = await getAgent(db, task.agentId);
  const priorSession = await getLastTaskSession(
    db,
    task.agentId,
    task.conversationId
  );

  return writeJSON({
    task: {
      ...taskToResponse(task),
      agent: agent
        ? {
            instructions: agent.instructions,
            name: agent.name,
            runtime_config: agent.runtimeConfig || {},
          }
        : null,
      prior_session_id: priorSession?.sessionId ?? null,
      prior_work_dir: priorSession?.workDir ?? null,
    },
  });
});
