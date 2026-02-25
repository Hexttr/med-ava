import { getDb } from "./db"

const KEYS = {
  organizationName: "organization_name",
  backgroundMedical: "background_medical",
  backgroundCorporate: "background_corporate",
} as const

export interface AppSettings {
  organizationName: string
  backgroundMedical: string
  backgroundCorporate: string
}

export function getAppSettings(): AppSettings {
  const db = getDb()
  const rows = db.prepare("SELECT key, value FROM app_settings WHERE key IN (?, ?, ?)").all(
    KEYS.organizationName,
    KEYS.backgroundMedical,
    KEYS.backgroundCorporate
  ) as Array<{ key: string; value: string | null }>
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]))
  return {
    organizationName: map.get(KEYS.organizationName) ?? "",
    backgroundMedical: map.get(KEYS.backgroundMedical) ?? "",
    backgroundCorporate: map.get(KEYS.backgroundCorporate) ?? "",
  }
}

export function setAppSettings(updates: Partial<AppSettings>): void {
  const db = getDb()
  const stmt = db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
  if (updates.organizationName !== undefined) {
    stmt.run(KEYS.organizationName, String(updates.organizationName).trim())
  }
  if (updates.backgroundMedical !== undefined) {
    stmt.run(KEYS.backgroundMedical, String(updates.backgroundMedical).trim())
  }
  if (updates.backgroundCorporate !== undefined) {
    stmt.run(KEYS.backgroundCorporate, String(updates.backgroundCorporate).trim())
  }
}
