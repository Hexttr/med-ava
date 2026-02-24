/**
 * Система логирования EAM: консоль с меткой времени и контекстом.
 * В development все уровни; в production — только warn/error.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
const isDev = process.env.NODE_ENV === "development"
const minLevel = isDev ? LOG_LEVELS.debug : LOG_LEVELS.warn

function ts(): string {
  return new Date().toISOString()
}

function formatMsg(level: string, tag: string, message: string, data?: Record<string, unknown>): string {
  const dataStr = data && Object.keys(data).length > 0 ? " " + JSON.stringify(data) : ""
  return `${ts()} [EAM] [${level.toUpperCase()}] ${tag} ${message}${dataStr}`
}

function log(level: keyof typeof LOG_LEVELS, tag: string, message: string, data?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < minLevel) return
  const line = formatMsg(level, tag, message, data)
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (tag: string, message: string, data?: Record<string, unknown>) => log("debug", tag, message, data),
  info: (tag: string, message: string, data?: Record<string, unknown>) => log("info", tag, message, data),
  warn: (tag: string, message: string, data?: Record<string, unknown>) => log("warn", tag, message, data),
  error: (tag: string, message: string, data?: Record<string, unknown>) => log("error", tag, message, data),
}

/** Санитизация URL: убираем ключ из query */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.searchParams.has("key")) u.searchParams.set("key", "***")
    return u.origin + u.pathname + (u.search ? "?" + u.search : "")
  } catch {
    return url.replace(/key=[^&]+/, "key=***")
  }
}
