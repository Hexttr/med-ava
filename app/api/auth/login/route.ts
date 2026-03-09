import { NextRequest, NextResponse } from "next/server"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, verifyCsrf, checkLoginRateLimit, clearLoginRateLimit } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { enforceTrustedOrigin, getClientIp, withNoStore } from "@/lib/request-security"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const originError = enforceTrustedOrigin(request)
    if (originError) {
      logger.warn("AUTH", "Rejected login request from untrusted origin")
      return withNoStore(originError)
    }

    const ip = getClientIp(request)
    const { allowed } = checkLoginRateLimit(ip)
    if (!allowed) {
      logger.warn("AUTH", "Login rate limit exceeded", { ip })
      return withNoStore(NextResponse.json(
        { success: false, error: "Слишком много попыток. Повторите через 15 минут." },
        { status: 429 }
      ))
    }

    const body = await request.json()
    const password = typeof body?.password === "string" ? body.password.trim() : ""
    const csrfToken = typeof body?.csrfToken === "string" ? body.csrfToken : ""

    if (!password) {
      return withNoStore(NextResponse.json({ success: false, error: "Введите пароль" }, { status: 400 }))
    }

    const validCsrf = await verifyCsrf(csrfToken)
    if (!validCsrf) {
      logger.warn("AUTH", "Invalid CSRF token")
      return withNoStore(NextResponse.json(
        { success: false, error: "Сессия истекла. Обновите страницу." },
        { status: 400 }
      ))
    }

    const expected = process.env.EAM_PASSWORD?.trim()
    if (!expected) {
      return withNoStore(NextResponse.json(
        { success: false, error: "Авторизация не настроена" },
        { status: 500 }
      ))
    }

    if (password !== expected) {
      return withNoStore(NextResponse.json(
        { success: false, error: "Неверный пароль" },
        { status: 401 }
      ))
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
    return withNoStore(response)
  } catch (e) {
    logger.error("AUTH", "Login error", { error: e instanceof Error ? e.message : String(e) })
    return withNoStore(NextResponse.json(
      { success: false, error: "Ошибка при входе" },
      { status: 500 }
    ))
  }
}
