import { NextRequest, NextResponse } from "next/server"

import { getPublicUrl } from "@/lib/runtime-config"

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getForwardedOrigin(request: NextRequest): string | null {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim()
  if (!host) return null

  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "")

  return normalizeOrigin(`${proto}://${host}`)
}

export function getAllowedOrigins(request: NextRequest): string[] {
  const values = [
    normalizeOrigin(request.nextUrl.origin),
    getForwardedOrigin(request),
    normalizeOrigin(getPublicUrl()),
  ].filter((value): value is string => Boolean(value))

  return [...new Set(values)]
}

export function enforceTrustedOrigin(request: NextRequest): NextResponse | null {
  const actualOrigin = normalizeOrigin(
    request.headers.get("origin") ||
    request.headers.get("referer")
  )

  if (!actualOrigin) {
    return NextResponse.json(
      { error: "Origin header is required" },
      { status: 403 }
    )
  }

  const allowedOrigins = getAllowedOrigins(request)
  if (!allowedOrigins.includes(actualOrigin)) {
    return NextResponse.json(
      { error: "Untrusted request origin" },
      { status: 403 }
    )
  }

  return null
}

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
}

export function withNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  return response
}
