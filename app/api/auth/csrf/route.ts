import { NextResponse } from "next/server"
import { generateCsrfToken, setCsrfCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const token = generateCsrfToken()
  await setCsrfCookie(token)
  return NextResponse.json({ token })
}
