import { NextResponse } from "next/server"
import { SESSION_COOKIE } from "@/lib/auth"
import { withNoStore } from "@/lib/request-security"

export const dynamic = "force-dynamic"

function logoutResponse() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" })
  return withNoStore(res)
}

export async function GET() {
  return withNoStore(NextResponse.json(
    { success: false, error: "Use POST to log out" },
    { status: 405 }
  ))
}

export async function POST() {
  return logoutResponse()
}
