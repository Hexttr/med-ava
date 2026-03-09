import { NextResponse } from "next/server"
import { withNoStore } from "@/lib/request-security"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const startTime = Date.now()

export async function GET() {
  return withNoStore(NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  }))
}
