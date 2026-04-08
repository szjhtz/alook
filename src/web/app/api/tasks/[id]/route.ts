import { db } from "@/lib/db";
import { getTask } from "@/lib/db/queries/task";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { taskToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) {
    return writeError("task id is required", 400);
  }

  const task = await getTask(db, id);
  if (!task || task.workspaceId !== ws.workspaceId) {
    return writeError("task not found", 404);
  }

  return writeJSON(taskToResponse(task));
});
