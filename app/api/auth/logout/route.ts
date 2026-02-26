import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

function getLoginUrl(request: NextRequest): URL {
  const url = new URL(request.url)
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const origin =
    process.env.EAM_PUBLIC_URL?.trim() ||
    (!isLocalhost ? request.url : null) ||
    request.url
  return new URL("/login", origin)
}

export async function GET(request: NextRequest) {
  await clearSessionCookie()
  return NextResponse.redirect(getLoginUrl(request), 303)
}

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
