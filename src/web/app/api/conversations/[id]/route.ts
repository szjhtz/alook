import { db } from "@/lib/db";
import { getConversation } from "@/lib/db/queries/conversation";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { conversationToResponse } from "@/lib/api/responses";

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

  return writeJSON(conversationToResponse(conversation));
});
