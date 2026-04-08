import { db } from "@/lib/db";
import { getUser } from "@/lib/db/queries/user";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { userToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (_req, ctx) => {
  const user = await getUser(db, ctx.userId);
  if (!user) {
    return writeError("user not found", 404);
  }
  return writeJSON(userToResponse(user));
});
