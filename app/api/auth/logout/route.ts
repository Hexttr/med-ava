import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  await clearSessionCookie()
  const url = new URL("/login", request.url)
  return NextResponse.redirect(url)
}

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
