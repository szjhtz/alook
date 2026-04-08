import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  listTaskMessages,
  createTaskMessage,
} from "@/lib/db/queries/task-message";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { taskMessageToResponse } from "@/lib/api/responses";
import { ReportMessagesRequestSchema } from "@alook/shared";

export const GET = withAuth(async (_req, ctx) => {
  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const messages = await listTaskMessages(db, taskId);
  return writeJSON(messages.map(taskMessageToResponse));
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const [body, err] = await parseBody(req, ReportMessagesRequestSchema);
  if (err) return err;

  if (body.messages.length === 0) {
    return writeJSON({ status: "ok" });
  }

  for (const m of body.messages) {
    createTaskMessage(db, {
      taskId,
      seq: m.seq,
      type: m.type,
      tool: m.tool || "",
      content: m.content || "",
      input: m.input,
      output: m.output || "",
    }).catch((e) => {
      console.warn("failed to create task message:", e);
    });
  }

  return writeJSON({ status: "ok" });
});
