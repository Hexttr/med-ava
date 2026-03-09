import { NextResponse } from "next/server"
import { generateCsrfToken, setCsrfCookie } from "@/lib/auth"
import { withNoStore } from "@/lib/request-security"

export const dynamic = "force-dynamic"

export async function GET() {
  const token = generateCsrfToken()
  await setCsrfCookie(token)
  return withNoStore(NextResponse.json({ token }))
}
