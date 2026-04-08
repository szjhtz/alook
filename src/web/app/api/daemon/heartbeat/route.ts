import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { updateAgentRuntimeHeartbeat } from "@/lib/db/queries/runtime";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, parseBody } from "@/lib/middleware/helpers";
import { HeartbeatRequestSchema } from "@alook/shared";

export const POST = withAuth(async (req: NextRequest) => {
  const [body, err] = await parseBody(req, HeartbeatRequestSchema);
  if (err) return err;

  await updateAgentRuntimeHeartbeat(db, body.runtime_id);

  return writeJSON({ status: "ok" });
});
