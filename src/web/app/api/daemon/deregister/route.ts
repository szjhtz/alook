import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { setAgentRuntimeOffline } from "@/lib/db/queries/runtime";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, parseBody } from "@/lib/middleware/helpers";
import { DeregisterRequestSchema } from "@alook/shared";

export const POST = withAuth(async (req: NextRequest) => {
  const [body, err] = await parseBody(req, DeregisterRequestSchema);
  if (err) return err;

  for (const id of body.runtime_ids) {
    try {
      await setAgentRuntimeOffline(db, id);
    } catch (e) {
      console.warn(`failed to set runtime ${id} offline:`, e);
    }
  }

  return writeJSON({ status: "ok" });
});
