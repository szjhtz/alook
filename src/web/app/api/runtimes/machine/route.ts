import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { deleteRuntimesByDaemonId } from "@/lib/db/queries/runtime";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const daemonId = req.nextUrl.searchParams.get("daemon_id");
  if (!daemonId) {
    return writeJSON({ error: "daemon_id is required" }, 400);
  }

  try {
    await deleteRuntimesByDaemonId(db, daemonId, ws.workspaceId);
  } catch (e) {
    console.error("Failed to delete machine:", e);
    return writeJSON({ error: "Failed to remove machine" }, 500);
  }

  return new Response(null, { status: 204 });
});
