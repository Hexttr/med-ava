import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  await clearSessionCookie()
  return NextResponse.redirect("/login", 303)
}

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
