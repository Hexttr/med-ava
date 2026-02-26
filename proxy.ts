import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionCookie } from "@/lib/auth-cookie"

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/csrf",
  "/api/auth/logout",
  "/api/health",
]

/**
 * Авторизация: если задан EAM_PASSWORD в .env,
 * все запросы требуют вход через форму /login.
 * /api/health — без авторизации (для мониторинга).
 */
export function proxy(request: NextRequest) {
  const password = process.env.EAM_PASSWORD?.trim()
  if (!password) return NextResponse.next()

  const pathname = request.nextUrl.pathname
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get("eam_session")?.value
  if (verifySessionCookie(sessionCookie)) {
    return NextResponse.next()
  }

  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search)

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized", redirect: loginUrl.pathname + loginUrl.search },
      { status: 401 }
    )
  }
  return NextResponse.redirect(loginUrl, 303)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
