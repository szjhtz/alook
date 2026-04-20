import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createAuth } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  if (
    request.headers.get("x-forwarded-proto") === "http" &&
    !request.nextUrl.hostname.startsWith("localhost") &&
    !request.nextUrl.hostname.startsWith("127.")
  ) {
    const httpsUrl = new URL(request.url)
    httpsUrl.protocol = "https:"
    return NextResponse.redirect(httpsUrl, 301)
  }

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const { env } = await getCloudflareContext({ async: true })
    const auth = createAuth(env as Env)
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon\\.ico|.*\\..*).*)"],
}
