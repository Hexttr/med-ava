import { cookies } from "next/headers"
import crypto from "crypto"

import { getSessionSecret } from "@/lib/runtime-config"

export const SESSION_COOKIE = "eam_session"
const CSRF_COOKIE = "eam_csrf"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 дней

function getSecret(): string {
  return getSessionSecret()
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex")
}

const LOGIN_RATE_LIMIT = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const RATE_WINDOW_MS = 15 * 60 * 1000 // 15 мин

import { verifySessionCookie as verifyCookie } from "./auth-cookie"

export { verifySessionCookie } from "./auth-cookie"

export function checkLoginRateLimit(ip: string): { allowed: boolean; remainingAttempts: number } {
  const now = Date.now()
  let entry = LOGIN_RATE_LIMIT.get(ip)
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS }
    LOGIN_RATE_LIMIT.set(ip, entry)
  }
  entry.count++
  const remaining = Math.max(0, MAX_ATTEMPTS - entry.count)
  return { allowed: entry.count <= MAX_ATTEMPTS, remainingAttempts: remaining }
}

export function clearLoginRateLimit(ip: string): void {
  LOGIN_RATE_LIMIT.delete(ip)
}

export function createSessionToken(): string {
  const payload = { exp: Date.now() + SESSION_MAX_AGE * 1000 }
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url")
  const signed = `${encoded}.${sign(encoded)}`
  return signed
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(SESSION_COOKIE)
  return cookie?.value ?? null
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken()
  return !!token && verifyCookie(token)
}

export async function setSessionCookie(): Promise<void> {
  const signed = createSessionToken()
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.EAM_HTTPS === "true",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex")
}

export async function setCsrfCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.EAM_HTTPS === "true",
    sameSite: "lax",
    maxAge: 60 * 30,
    path: "/",
  })
}

export async function verifyCsrf(token: string): Promise<boolean> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(CSRF_COOKIE)
  return !!cookie?.value && cookie.value === token && token.length === 48
}
