import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/db/queries/workspace";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { workspaceToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (_req, ctx) => {
  const id = ctx.params?.id;
  if (!id) {
    return writeError("workspace id is required", 400);
  }

  const workspace = await getWorkspace(db, id);
  if (!workspace) {
    return writeError("workspace not found", 404);
  }

  return writeJSON(workspaceToResponse(workspace));
});
