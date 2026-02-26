import { getDb } from "./db"
import { MODEL_ANALYSIS_OPTIONS, MODEL_GENERATION_OPTIONS } from "./model-options"

const KEYS = {
  organizationName: "organization_name",
  backgroundMedical: "background_medical",
  backgroundCorporate: "background_corporate",
  backgroundMedicalImage: "background_medical_image",
  backgroundCorporateImage: "background_corporate_image",
  backgroundMode: "background_mode",
  modelAnalysis: "model_analysis",
  modelGeneration: "model_generation",
  promptAnalysis: "prompt_analysis",
  promptUniversalFraming: "prompt_universal_framing",
  promptMedicalInstruction: "prompt_medical_instruction",
  promptCorporateInstruction: "prompt_corporate_instruction",
  promptNegative: "prompt_negative",
} as const

export interface AppSettings {
  organizationName: string
  backgroundMedical: string
  backgroundCorporate: string
  backgroundMedicalImage: string
  backgroundCorporateImage: string
  backgroundMode: "description" | "image"
  modelAnalysis: string
  modelGeneration: string
  promptAnalysis: string
  promptUniversalFraming: string
  promptMedicalInstruction: string
  promptCorporateInstruction: string
  promptNegative: string
}

const ALL_KEYS = [
  KEYS.organizationName,
  KEYS.backgroundMedical,
  KEYS.backgroundCorporate,
  KEYS.backgroundMedicalImage,
  KEYS.backgroundCorporateImage,
  KEYS.backgroundMode,
  KEYS.modelAnalysis,
  KEYS.modelGeneration,
  KEYS.promptAnalysis,
  KEYS.promptUniversalFraming,
  KEYS.promptMedicalInstruction,
  KEYS.promptCorporateInstruction,
  KEYS.promptNegative,
] as const

export function getAppSettings(): AppSettings {
  const db = getDb()
  const placeholders = ALL_KEYS.map(() => "?").join(", ")
  const rows = db.prepare(`SELECT key, value FROM app_settings WHERE key IN (${placeholders})`).all(...ALL_KEYS) as Array<{ key: string; value: string | null }>
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]))
  return {
    organizationName: map.get(KEYS.organizationName) ?? "",
    backgroundMedical: map.get(KEYS.backgroundMedical) ?? "",
    backgroundCorporate: map.get(KEYS.backgroundCorporate) ?? "",
    backgroundMedicalImage: map.get(KEYS.backgroundMedicalImage) ?? "",
    backgroundCorporateImage: map.get(KEYS.backgroundCorporateImage) ?? "",
    backgroundMode: (map.get(KEYS.backgroundMode) === "image" ? "image" : "description") as "description" | "image",
    modelAnalysis: map.get(KEYS.modelAnalysis) || MODEL_ANALYSIS_OPTIONS[0].value,
    modelGeneration: map.get(KEYS.modelGeneration) || MODEL_GENERATION_OPTIONS[0].value,
    promptAnalysis: map.get(KEYS.promptAnalysis) ?? "",
    promptUniversalFraming: map.get(KEYS.promptUniversalFraming) ?? "",
    promptMedicalInstruction: map.get(KEYS.promptMedicalInstruction) ?? "",
    promptCorporateInstruction: map.get(KEYS.promptCorporateInstruction) ?? "",
    promptNegative: map.get(KEYS.promptNegative) ?? "",
  }
}

export function setAppSettings(updates: Partial<AppSettings>): void {
  const db = getDb()
  const stmt = db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
  const mapping: [string, keyof AppSettings][] = [
    [KEYS.organizationName, "organizationName"],
    [KEYS.backgroundMedical, "backgroundMedical"],
    [KEYS.backgroundCorporate, "backgroundCorporate"],
    [KEYS.backgroundMedicalImage, "backgroundMedicalImage"],
    [KEYS.backgroundCorporateImage, "backgroundCorporateImage"],
    [KEYS.backgroundMode, "backgroundMode"],
    [KEYS.modelAnalysis, "modelAnalysis"],
    [KEYS.modelGeneration, "modelGeneration"],
    [KEYS.promptAnalysis, "promptAnalysis"],
    [KEYS.promptUniversalFraming, "promptUniversalFraming"],
    [KEYS.promptMedicalInstruction, "promptMedicalInstruction"],
    [KEYS.promptCorporateInstruction, "promptCorporateInstruction"],
    [KEYS.promptNegative, "promptNegative"],
  ]
  for (const [key, prop] of mapping) {
    const val = updates[prop]
    if (val !== undefined) {
      stmt.run(key, String(val).trim())
    }
  }
}
