import { db } from "@/lib/db";
import { getTaskStatus } from "@/lib/db/queries/task";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";

export const GET = withAuth(async (_req, ctx) => {
  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const status = await getTaskStatus(db, taskId);
  if (!status) {
    return writeError("task not found", 404);
  }

  return writeJSON({ status });
});
