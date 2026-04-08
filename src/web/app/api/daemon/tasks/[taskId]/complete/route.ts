import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { taskToResponse } from "@/lib/api/responses";
import { TaskService } from "@/lib/services/task";
import { CompleteTaskRequestSchema } from "@alook/shared";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const [body, err] = await parseBody(req, CompleteTaskRequestSchema);
  if (err) return err;

  const result = JSON.stringify(body);
  const sessionId = body.session_id || "";
  const workDir = body.work_dir || "";

  const taskService = new TaskService(db);
  try {
    const task = await taskService.completeTask(
      taskId,
      result,
      sessionId,
      workDir
    );
    return writeJSON(taskToResponse(task));
  } catch (e: any) {
    return writeError(e.message, 400);
  }
});
