/**
 * Система логирования EAM: консоль с меткой времени и контекстом.
 * В development все уровни; в production — только warn/error.
 * Логи пишутся в файл data/eam-logs.jsonl для отображения в разделе Диагностика
 * (сохраняются между запросами, в т.ч. при serverless).
 */

import fs from "fs"
import path from "path"

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
const isDev = process.env.NODE_ENV === "development"
const minLevel = isDev ? LOG_LEVELS.debug : LOG_LEVELS.warn

const MAX_BUFFER_SIZE = 200
const MAX_LOG_FILE_LINES = 5000
const MAX_LOG_FILE_SIZE_BYTES = 2 * 1024 * 1024

export interface LogEntry {
  id: string
  ts: string
  level: string
  tag: string
  message: string
  data?: Record<string, unknown>
  raw: string
}

const logBuffer: LogEntry[] = []
let logIdCounter = 0

function getLogFilePath(): string {
  return path.join(process.cwd(), "data", "eam-logs.jsonl")
}

function ts(): string {
  return new Date().toISOString()
}

function formatMsg(level: string, tag: string, message: string, data?: Record<string, unknown>): string {
  const dataStr = data && Object.keys(data).length > 0 ? " " + JSON.stringify(data) : ""
  return `${ts()} [EAM] [${level.toUpperCase()}] ${tag} ${message}${dataStr}`
}

function appendToFile(entry: LogEntry): void {
  try {
    const filePath = getLogFilePath()
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const line = JSON.stringify(entry) + "\n"
    fs.appendFileSync(filePath, line)

    // Проверяем ротацию только по размеру файла, чтобы не перечитывать лог на каждую запись.
    const stats = fs.statSync(filePath)
    if (stats.size > MAX_LOG_FILE_SIZE_BYTES) {
      const content = fs.readFileSync(filePath, "utf-8")
      const lines = content.split("\n").filter(Boolean)
      const keep = lines.slice(-MAX_LOG_FILE_LINES)
      fs.writeFileSync(filePath, keep.join("\n") + "\n")
    }
  } catch {
    // Игнорируем ошибки записи (например, read-only FS на Vercel)
  }
}

function pushToBuffer(level: string, tag: string, message: string, data?: Record<string, unknown>): void {
  const raw = formatMsg(level, tag, message, data)
  const entry: LogEntry = {
    id: `log-${++logIdCounter}`,
    ts: new Date().toISOString(),
    level,
    tag,
    message,
    data,
    raw,
  }
  logBuffer.push(entry)
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift()
  }
  appendToFile(entry)
}

function log(level: keyof typeof LOG_LEVELS, tag: string, message: string, data?: Record<string, unknown>): void {
  pushToBuffer(level, tag, message, data)
  if (LOG_LEVELS[level as keyof typeof LOG_LEVELS] < minLevel) return
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

/** Возвращает последние N записей из буфера логов (для раздела Диагностика). */
export function getLogBuffer(limit = 100): LogEntry[] {
  try {
    const filePath = getLogFilePath()
    if (!fs.existsSync(filePath)) return logBuffer.slice(-limit)
    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.split("\n").filter(Boolean)
    const entries: LogEntry[] = []
    for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
      try {
        const e = JSON.parse(lines[i]) as LogEntry
        if (e.ts && e.tag && e.message) entries.push(e)
      } catch {
        /* ignore malformed lines */
      }
    }
    return entries.length > 0 ? entries : logBuffer.slice(-limit)
  } catch {
    return logBuffer.slice(-limit)
  }
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
