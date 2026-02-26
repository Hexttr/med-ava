import { NextRequest, NextResponse } from "next/server"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, verifyCsrf, checkLoginRateLimit, clearLoginRateLimit } from "@/lib/auth"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const { allowed, remainingAttempts } = checkLoginRateLimit(ip)
    if (!allowed) {
      logger.warn("AUTH", "Login rate limit exceeded", { ip })
      return NextResponse.json(
        { success: false, error: "Слишком много попыток. Повторите через 15 минут." },
        { status: 429 }
      )
    }

    const body = await request.json()
    const password = typeof body?.password === "string" ? body.password.trim() : ""
    const csrfToken = typeof body?.csrfToken === "string" ? body.csrfToken : ""

    if (!password) {
      return NextResponse.json({ success: false, error: "Введите пароль" }, { status: 400 })
    }

    const validCsrf = await verifyCsrf(csrfToken)
    if (!validCsrf) {
      logger.warn("AUTH", "Invalid CSRF token")
      return NextResponse.json(
        { success: false, error: "Сессия истекла. Обновите страницу." },
        { status: 400 }
      )
    }

    const expected = process.env.EAM_PASSWORD?.trim()
    if (!expected) {
      return NextResponse.json(
        { success: false, error: "Авторизация не настроена" },
        { status: 500 }
      )
    }

    if (password !== expected) {
      return NextResponse.json(
        { success: false, error: "Неверный пароль" },
        { status: 401 }
      )
    }

    clearLoginRateLimit(ip)
    logger.info("AUTH", "Login successful", { ip })
    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.EAM_HTTPS === "true",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    })
    return response
  } catch (e) {
    logger.error("AUTH", "Login error", { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(
      { success: false, error: "Ошибка при входе" },
      { status: 500 }
    )
  }
}
