import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createDb, queries, AddWhitelistRequestSchema } from "@alook/shared"
import { withAuth } from "@/lib/middleware/auth"
import { withWorkspaceMember } from "@/lib/middleware/workspace"
import { writeJSON, writeError, parseBody, formatTimestamp } from "@/lib/middleware/helpers"

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext();
  const db = createDb((env as Env).DB);

  const agentId = ctx.params?.id;
  if (!agentId) return writeError("agent id is required", 400);

  const agent = await queries.agent.getAgent(db, agentId, ws.workspaceId);
  if (!agent) return writeError("agent not found", 404);

  const entries = await queries.whitelist.getWhitelist(db, agentId, ws.workspaceId);
  return writeJSON(
    entries.map((w) => ({
      id: w.id,
      email: w.email,
      created_at: formatTimestamp(w.createdAt),
    }))
  );
});

export const POST = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const { env } = getCloudflareContext();
  const db = createDb((env as Env).DB);

  const agentId = ctx.params?.id;
  if (!agentId) return writeError("agent id is required", 400);

  const agent = await queries.agent.getAgent(db, agentId, ws.workspaceId);
  if (!agent) return writeError("agent not found", 404);

  const [body, err] = await parseBody(req, AddWhitelistRequestSchema);
  if (err) return err;

  const email = body.email.toLowerCase();
  const entry = await queries.whitelist.addWhitelist(db, agentId, ws.workspaceId, email);
  if (!entry) return writeError("email already whitelisted", 409);

  return writeJSON(
    {
      id: entry.id,
      email: entry.email,
      created_at: formatTimestamp(entry.createdAt),
    },
    201
  );
});
