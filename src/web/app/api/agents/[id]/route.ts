import { db } from "@/lib/db";
import { getAgentInWorkspace } from "@/lib/db/queries/agent";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { agentToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) {
    return writeError("agent id is required", 400);
  }

  const agent = await getAgentInWorkspace(db, id, ws.workspaceId);
  if (!agent) {
    return writeError("agent not found", 404);
  }

  return writeJSON(agentToResponse(agent));
});
