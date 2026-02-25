/**
 * Промпты для анализа и генерации портретов.
 * Читает из app_settings; при пустых значениях использует встроенные по умолчанию.
 */

import { getAppSettings } from "./app-settings"

const DEFAULT_UNIVERSAL_FRAMING =
  "Standard portrait framing: head and upper torso only, bust-length, shoulders visible, same head-to-body scale for ALL portraits (medical and corporate must be IDENTICAL crop and proportions). Do not crop tighter or wider. Same framing in both styles."

const DEFAULT_ANALYSIS_PROMPT = `You are a professional portrait photography prompt engineer for an AI image generation system. Your goal is to produce text prompts that will generate portraits where the face is MAXIMUM LIKENESS to the source photo.

Analyze this photo of a person named "{employeeName}". You MUST describe the face in precise, unambiguous detail:
- Exact face shape (oval, round, square, heart, etc.)
- Skin tone and texture (specific shade, any visible features)
- Hair: color, exact style, length, parting, any distinctive detail
- Eyes: color, shape, spacing, eyebrows (shape and color)
- Nose and mouth: shape, lip fullness, any distinctive traits
- Approximate age and gender presentation
- Any distinguishing features (moles, freckles, scars, glasses imprint, etc.)

Based on your analysis, create TWO detailed prompts for generating professional portraits. Each prompt MUST start with a full, precise description of this person's face and head so the generated image looks like the SAME person.

UNIVERSAL FRAMING RULE (applies to every portrait in the system—single and batch, medical and corporate): All generated portraits MUST use the exact same composition. You MUST include this exact phrase in both prompts: "Standard portrait framing: head and upper torso only, bust-length, shoulders visible, same head-to-body scale as all other portraits in the system." This ensures every portrait across all sessions has identical proportions.

1. MEDICAL PORTRAIT: First describe the person's face and appearance in full detail (so the portrait is unmistakably the same person), then include the standard portrait framing phrase above, then: wearing a crisp white medical doctor's coat, professional medical setting. Clean, well-lit studio backdrop in light gray or white. Warm, approachable expression. High-quality studio photography lighting.

2. CORPORATE PORTRAIT: First describe the person's face and appearance in full detail (same as above—identical person), then include the same standard portrait framing phrase (identical wording), then: in professional business attire (dark suit/blazer). Clean corporate background in dark navy or charcoal gray. Confident, professional expression. Studio photography with rim lighting.

CRITICAL: Both prompts must describe the EXACT SAME person from the photo. The face in the generated image must be recognizable as this person. Lead each prompt with a detailed facial description so the AI image model preserves identity and likeness. The framing phrase must be identical in both prompts so that every portrait ever generated in this app has the same proportions.

Respond with ONLY one valid JSON object (no markdown, no \`\`\` code fences, no extra text). Use double quotes for keys and strings; escape any " inside strings as \". Required keys: description, medicalPrompt, corporatePrompt. Example structure:
{
  "description": "Brief description of the person",
  "medicalPrompt": "Full prompt for medical portrait...",
  "corporatePrompt": "Full prompt for corporate portrait..."
}`

const DEFAULT_MEDICAL_INSTRUCTION =
  "Show this person in a crisp white medical doctor's coat. {backdrop} Warm, approachable expression."

const DEFAULT_CORPORATE_INSTRUCTION =
  "Show this person in professional business attire (dark suit/blazer). {backdrop} Confident, professional expression."

const DEFAULT_NEGATIVE_PROMPT =
  "Avoid: blurry, distorted face, different identity, over-smoothing, artificial skin, wrong proportions."

/** Значения по умолчанию для отображения в настройках (когда поле пустое в БД). */
export function getPromptDefaults() {
  return {
    promptAnalysis: DEFAULT_ANALYSIS_PROMPT,
    promptUniversalFraming: DEFAULT_UNIVERSAL_FRAMING,
    promptMedicalInstruction: DEFAULT_MEDICAL_INSTRUCTION,
    promptCorporateInstruction: DEFAULT_CORPORATE_INSTRUCTION,
    promptNegative: DEFAULT_NEGATIVE_PROMPT,
  }
}

export function getAnalysisPrompt(employeeName: string): string {
  const s = getAppSettings()
  const template = s.promptAnalysis.trim() || DEFAULT_ANALYSIS_PROMPT
  return template.replace(/\{employeeName\}/g, employeeName || "Сотрудник")
}

export function getUniversalFraming(): string {
  const s = getAppSettings()
  return s.promptUniversalFraming.trim() || DEFAULT_UNIVERSAL_FRAMING
}

export function getMedicalInstruction(backdrop: string): string {
  const s = getAppSettings()
  const template = s.promptMedicalInstruction.trim() || DEFAULT_MEDICAL_INSTRUCTION
  return template.replace(/\{backdrop\}/g, backdrop)
}

export function getCorporateInstruction(backdrop: string): string {
  const s = getAppSettings()
  const template = s.promptCorporateInstruction.trim() || DEFAULT_CORPORATE_INSTRUCTION
  return template.replace(/\{backdrop\}/g, backdrop)
}

export function getNegativePrompt(): string {
  const s = getAppSettings()
  return s.promptNegative.trim() || DEFAULT_NEGATIVE_PROMPT
}
