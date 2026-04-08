import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteMachineToken } from "@/lib/db/queries/machine-token";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";

export const DELETE = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) {
    return NextResponse.json(
      { error: "token id is required" },
      { status: 400 }
    );
  }

  await deleteMachineToken(db, id, ctx.userId);

  return new NextResponse(null, { status: 204 });
});
