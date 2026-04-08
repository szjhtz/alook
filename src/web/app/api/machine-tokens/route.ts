import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  listMachineTokens,
  createMachineToken,
} from "@/lib/db/queries/machine-token";
import { generateMachineToken, hashToken } from "@/lib/auth/jwt";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { machineTokenToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const tokens = await listMachineTokens(db, ctx.userId, ws.workspaceId);
  return writeJSON(tokens.map(machineTokenToResponse));
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  let name = "default";
  try {
    const body = await req.json();
    if (body.name && typeof body.name === "string" && body.name.trim()) {
      name = body.name.trim();
    }
  } catch {
    // body parse error → use default name
  }

  const raw = generateMachineToken();
  const tokenHash = hashToken(raw);

  const mt = await createMachineToken(db, {
    userId: ctx.userId,
    workspaceId: ws.workspaceId,
    tokenHash,
    name,
  });

  return writeJSON({ token: raw, ...machineTokenToResponse(mt) }, 201);
});
