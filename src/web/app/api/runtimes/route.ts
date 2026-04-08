import { db } from "@/lib/db";
import { listAgentRuntimes } from "@/lib/db/queries/runtime";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";
import { runtimeToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const runtimes = await listAgentRuntimes(db, ws.workspaceId);
  return writeJSON(runtimes.map(runtimeToResponse));
});
