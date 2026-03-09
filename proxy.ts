import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionCookie } from "@/lib/auth-cookie"
import { isAuthEnabled } from "@/lib/runtime-config"

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/csrf",
  "/api/auth/logout",
  "/api/health",
  "/api/ready",
]

/**
 * Авторизация: если задан EAM_PASSWORD в .env,
 * все запросы требуют вход через форму /login.
 * /api/health — без авторизации (для мониторинга).
 */
export function proxy(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next()

  const pathname = request.nextUrl.pathname
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next()
  }
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  try {
    const sessionCookie = request.cookies.get("eam_session")?.value
    if (verifySessionCookie(sessionCookie)) {
      return NextResponse.next()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication is misconfigured"
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    return new NextResponse(message, { status: 503 })
  }

  const redirectTarget = pathname + request.nextUrl.search
  const redirectPath = redirectTarget ? `/login?redirect=${encodeURIComponent(redirectTarget)}` : "/login"
  const url = new URL(request.url)
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const redirectBase = isLocalhost && process.env.EAM_PUBLIC_URL?.trim()
    ? process.env.EAM_PUBLIC_URL
    : request.url
  const redirectUrl = new URL(redirectPath, redirectBase).toString()

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized", redirect: redirectPath },
      { status: 401 }
    )
  }
  return NextResponse.redirect(redirectUrl, 303)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|icon\\.svg|placeholder\\.svg|placeholder-logo\\.svg).*)",
  ],
}
