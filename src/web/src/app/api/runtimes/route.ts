import { getCloudflareContext } from "@opennextjs/cloudflare"
import { queries } from "@alook/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";
import { runtimeToResponse } from "@/lib/api/responses";
import { cached, cacheKeys } from "@/lib/cache";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext()
  const db = getDb((env as Env).DB)

  const runtimes = await cached(cacheKeys.allRuntimes(ws.workspaceId), 120, () => queries.runtime.listAgentRuntimes(db, ws.workspaceId));

  return writeJSON(runtimes.map(runtimeToResponse));
});
