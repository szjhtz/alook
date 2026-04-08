import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getConversation } from "@/lib/db/queries/conversation";
import { listMessages, createMessage } from "@/lib/db/queries/message";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { messageToResponse, taskToResponse } from "@/lib/api/responses";
import { TaskService } from "@/lib/services/task";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) {
    return writeError("conversation id is required", 400);
  }

  const conversation = await getConversation(db, id);
  if (!conversation || conversation.workspaceId !== ws.workspaceId) {
    return writeError("conversation not found", 404);
  }

  const messages = await listMessages(db, id);
  return writeJSON(messages.map(messageToResponse));
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) {
    return writeError("conversation id is required", 400);
  }

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return writeError("invalid request body", 400);
  }

  const content = body.content || "";
  if (!content) {
    return writeError("content is required", 400);
  }

  const conversation = await getConversation(db, id);
  if (!conversation || conversation.workspaceId !== ws.workspaceId) {
    return writeError("conversation not found", 404);
  }

  const message = await createMessage(db, {
    conversationId: id,
    role: "user",
    content,
  });

  const taskService = new TaskService(db);
  try {
    const task = await taskService.enqueueTask(
      conversation.agentId,
      id,
      ws.workspaceId,
      content
    );
    return writeJSON(
      { message: messageToResponse(message), task: taskToResponse(task) },
      201
    );
  } catch (err: any) {
    console.error("enqueueTask error:", err);
    return writeJSON(
      {
        message: messageToResponse(message),
        task: null,
        error: err.message,
      },
      500
    );
  }
});
