import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  listWorkspaces,
  createWorkspace,
} from "@/lib/db/queries/workspace";
import { createMember } from "@/lib/db/queries/member";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { workspaceToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (_req, ctx) => {
  const workspaces = await listWorkspaces(db, ctx.userId);
  return writeJSON(workspaces.map(workspaceToResponse));
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  let body: { name?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return writeError("invalid request body", 400);
  }

  const name = (body.name || "").trim();
  const slug = (body.slug || "").toLowerCase().trim();

  if (!name) {
    return writeError("name is required", 400);
  }
  if (!slug) {
    return writeError("slug is required", 400);
  }

  try {
    const workspace = await db.transaction(async (tx: any) => {
      const ws = await createWorkspace(tx, { name, slug });
      await createMember(tx, {
        workspaceId: ws.id,
        userId: ctx.userId,
        role: "owner",
      });
      return ws;
    });
    return writeJSON(workspaceToResponse(workspace), 201);
  } catch (err: any) {
    if (err.code === "23505") {
      return writeError("workspace slug already exists", 409);
    }
    throw err;
  }
});
