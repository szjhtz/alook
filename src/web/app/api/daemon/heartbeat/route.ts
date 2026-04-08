import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { updateAgentRuntimeHeartbeat } from "@/lib/db/queries/runtime";
import { failStaleDispatchedTasks } from "@/lib/db/queries/task";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, parseBody } from "@/lib/middleware/helpers";
import { HeartbeatRequestSchema } from "@alook/shared";
import { TaskService } from "@/lib/services/task";

export const POST = withAuth(async (req: NextRequest) => {
  const [body, err] = await parseBody(req, HeartbeatRequestSchema);
  if (err) return err;

  await updateAgentRuntimeHeartbeat(db, body.runtime_id);

  // Fail tasks stuck in "dispatched" for >20s (daemon likely crashed)
  const stale = await failStaleDispatchedTasks(db);
  if (stale.length > 0) {
    const taskService = new TaskService(db);
    const agentIds = [...new Set(stale.map((r) => r.agentId))];
    for (const agentId of agentIds) {
      await taskService.reconcileAgentStatus(agentId);
    }
  }

  return writeJSON({ status: "ok" });
});
