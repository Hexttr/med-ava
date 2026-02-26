import { NextResponse } from "next/server"
import { SESSION_COOKIE } from "@/lib/auth"

export const dynamic = "force-dynamic"

function logoutResponse(redirect: boolean) {
  if (redirect) {
    const res = NextResponse.redirect("/login", 303)
    res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" })
    return res
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" })
  return res
}

export async function GET() {
  return logoutResponse(true)
}

export async function POST() {
  return logoutResponse(false)
}
