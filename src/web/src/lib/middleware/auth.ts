import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createDb, queries } from "@alook/shared"
import { createAuth } from "@/lib/auth"
import { createHash } from "crypto"

export interface AuthContext {
  userId: string
  email: string
  workspaceId?: string
}

export type AuthenticatedHandler = (
  req: NextRequest,
  ctx: AuthContext & { params?: Record<string, string> }
) => Promise<NextResponse | Response>

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function withAuth(handler: AuthenticatedHandler) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> | Record<string, string> }
  ) => {
    const resolvedParams = context?.params
      ? context.params instanceof Promise
        ? await context.params
        : context.params
      : undefined

    const { env } = await getCloudflareContext({ async: true })
    const cloudflareEnv = env as Env

    const authHeader = req.headers.get("Authorization")
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7)
      if (token.startsWith("al_")) {
        try {
          const db = createDb(cloudflareEnv.DB)
          const hashed = hashToken(token)
          const mt = await queries.machineToken.getMachineTokenByHash(db, hashed)
          if (!mt) {
            return NextResponse.json({ error: "invalid token" }, { status: 401 })
          }
          queries.machineToken.updateMachineTokenLastUsed(db, mt.id).catch(() => {})
          const authCtx: AuthContext = {
            userId: mt.userId,
            email: mt.userEmail,
            workspaceId: mt.workspaceId ?? undefined,
          }
          return handler(req, { ...authCtx, params: resolvedParams })
        } catch {
          return NextResponse.json({ error: "invalid token" }, { status: 401 })
        }
      }
    }

    // Fall back to Better Auth session
    try {
      const auth = createAuth(cloudflareEnv)
      const session = await auth.api.getSession({ headers: req.headers })
      if (!session) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
      }
      const authCtx: AuthContext = {
        userId: session.user.id,
        email: session.user.email,
      }
      return handler(req, { ...authCtx, params: resolvedParams })
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }
}
