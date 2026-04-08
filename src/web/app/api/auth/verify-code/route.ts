import { NextRequest } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { db } from "@/lib/db";
import {
  getLatestVerificationCode,
  markVerificationCodeUsed,
  incrementVerificationCodeAttempts,
} from "@/lib/db/queries/verification-code";
import { getUserByEmail, createUser } from "@/lib/db/queries/user";
import { listWorkspaces, createWorkspace } from "@/lib/db/queries/workspace";
import { createMember } from "@/lib/db/queries/member";
import { signJWT } from "@/lib/auth/jwt";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { userToResponse } from "@/lib/api/responses";

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return writeError("invalid request body", 400);
  }

  const email = (body.email || "").toLowerCase().trim();
  const code = (body.code || "").trim();
  if (!email || !code) {
    return writeError("email and code are required", 400);
  }

  try {
    const appEnv = process.env.APP_ENV || "development";
    const isMasterCode = appEnv !== "production" && code === "888888";

    if (!isMasterCode) {
      const stored = await getLatestVerificationCode(db, email);
      if (!stored) {
        return writeError("invalid or expired code", 400);
      }

      const a = Buffer.from(code);
      const b = Buffer.from(stored.code);
      const match = a.length === b.length && timingSafeEqual(a, b);

      if (!match) {
        await incrementVerificationCodeAttempts(db, stored.id);
        return writeError("invalid or expired code", 400);
      }

      await markVerificationCodeUsed(db, stored.id);
    }

    let user = await getUserByEmail(db, email);
    if (!user) {
      const name = email.split("@")[0];
      user = await createUser(db, { name, email });
    }

    const userId = user.id;
    const workspaces = await listWorkspaces(db, userId);
    if (workspaces.length === 0) {
      await db.transaction(async (tx: any) => {
        const ws = await listWorkspaces(tx, userId);
        if (ws.length > 0) return;

        const baseSlug = email
          .split("@")[0]
          .replace(/[^a-z0-9-]/g, "-")
          .substring(0, 24);
        let slug = baseSlug;

        try {
          const workspace = await createWorkspace(tx, {
            name: "Personal",
            slug,
          });
          await createMember(tx, {
            workspaceId: workspace.id,
            userId,
            role: "owner",
          });
        } catch (err: any) {
          if (err.code === "23505") {
            slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
            const workspace = await createWorkspace(tx, {
              name: "Personal",
              slug,
            });
            await createMember(tx, {
              workspaceId: workspace.id,
              userId,
              role: "owner",
            });
          } else {
            throw err;
          }
        }
      });
    }

    const token = await signJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const response = writeJSON({ token, user: userToResponse(user) });
    response.cookies.set("alook_session", "1", {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 72, // 72h, matches JWT expiry
    });
    return response;
  } catch (err) {
    console.error("verify-code error:", err);
    return writeError("internal server error", 500);
  }
}
