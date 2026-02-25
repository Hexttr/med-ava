import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGeminiKey } from "@/lib/settings"
import { getRateLimitStats } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const startTime = Date.now()

export async function GET() {
  try {
    const db = getDb()
    db.prepare("SELECT 1").get()
    const geminiKey = await getGeminiKey()
    const rateLimit = getRateLimitStats()

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: "ok",
        geminiKey: geminiKey ? "configured" : "missing",
        rateLimitTracked: rateLimit.totalTracked,
      },
    })
  } catch (e) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 503 }
    )
  }
}
