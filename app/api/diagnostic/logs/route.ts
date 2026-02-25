import { NextResponse } from "next/server"
import { getLogBuffer } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 200)
    const logs = getLogBuffer(limit)
    return NextResponse.json({ logs }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить логи" }, { status: 500 })
  }
}
