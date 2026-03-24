import { NextRequest, NextResponse } from "next/server"

import { getDb } from "@/lib/db"
import { logger } from "@/lib/logger"
import { checkRateLimit } from "@/lib/rate-limit"
import { getClientIp, withNoStore } from "@/lib/request-security"
import type { PublicReviewSearchResult } from "@/lib/types"

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 20

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const { allowed, resetIn } = checkRateLimit(`public-review-search:${ip}`, {
      maxRequests: 30,
      windowMs: 60 * 1000,
    })

    if (!allowed) {
      return withNoStore(
        NextResponse.json(
          { error: `Слишком много поисковых запросов. Попробуйте снова через ${resetIn} сек.` },
          { status: 429 }
        )
      )
    }

    const query = (new URL(request.url).searchParams.get("q") ?? "").trim()
    if (query.length < MIN_QUERY_LENGTH) {
      return withNoStore(NextResponse.json([] satisfies PublicReviewSearchResult[]))
    }

    const normalizedQuery = query.toLocaleLowerCase("ru")
    const database = getDb()
    const rows = database.prepare(
      `SELECT e.id, e.name, d.name AS department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       ORDER BY e.name ASC`
    ).all() as Array<{
      id: string
      name: string
      department_name: string | null
    }>

    const items = rows
      .filter((row) => row.name.toLocaleLowerCase("ru").includes(normalizedQuery))
      .slice(0, MAX_RESULTS)
      .map((row) => ({
        employeeId: row.id,
        name: row.name,
        departmentName: row.department_name ?? undefined,
      })) satisfies PublicReviewSearchResult[]

    return withNoStore(NextResponse.json(items))
  } catch (error) {
    logger.error("PUBLIC_REVIEW", "Search error", { error: error instanceof Error ? error.message : String(error) })
    return withNoStore(
      NextResponse.json({ error: "Не удалось выполнить поиск" }, { status: 500 })
    )
  }
}
