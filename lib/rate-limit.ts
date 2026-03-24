/**
 * Простой in-memory rate limiter для API.
 * Ограничение: N запросов в минуту на IP.
 */

const defaultWindowMs = 60 * 1000 // 1 минута
const defaultMaxRequests = 60 // analyze и generate по отдельности (до 60 сотрудников в минуту)

const store = new Map<string, { count: number; resetAt: number }>()

function cleanup() {
  const now = Date.now()
  for (const [key, val] of store.entries()) {
    if (val.resetAt < now) store.delete(key)
  }
}

export function checkRateLimit(
  identifier: string,
  options?: { windowMs?: number; maxRequests?: number }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  if (store.size > 1000) cleanup()

  const windowMs = options?.windowMs ?? defaultWindowMs
  const maxRequests = options?.maxRequests ?? defaultMaxRequests

  let entry = store.get(identifier)
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(identifier, entry)
  }

  entry.count++
  const remaining = Math.max(0, maxRequests - entry.count)
  const allowed = entry.count <= maxRequests

  return { allowed, remaining, resetIn: Math.max(0, Math.ceil((entry.resetAt - now) / 1000)) }
}

export function getRateLimitStats(): { totalTracked: number } {
  return { totalTracked: store.size }
}
