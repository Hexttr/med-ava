/**
 * Верификация сессионной cookie. Используется в proxy (без доступа к cookies()).
 */
import crypto from "crypto"

import { getSessionSecret } from "@/lib/runtime-config"

function getSecret(): string {
  return getSessionSecret()
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex")
}

export function verifySessionCookie(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false
  const [payload, sig] = cookieValue.split(".")
  if (!payload || !sig) return false
  if (sign(payload) !== sig) return false
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"))
    return !!data?.exp && data.exp > Date.now()
  } catch {
    return false
  }
}
