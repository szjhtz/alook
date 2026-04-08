import { db } from "@/lib/db";
import { getTask } from "@/lib/db/queries/task";
import {
  listTaskMessages,
  listTaskMessagesSince,
} from "@/lib/db/queries/task-message";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { taskMessageToResponse } from "@/lib/api/responses";

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

  const sinceParam = req.nextUrl.searchParams.get("since");
  let messages;

  if (sinceParam) {
    const afterSeq = parseInt(sinceParam, 10);
    if (isNaN(afterSeq)) {
      return writeError("invalid since parameter", 400);
    }
    messages = await listTaskMessagesSince(db, id, afterSeq);
  } else {
    messages = await listTaskMessages(db, id);
  }

  return writeJSON(messages.map(taskMessageToResponse));
});
