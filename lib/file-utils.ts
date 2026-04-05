/**
 * Читает файл как data URL без сжатия.
 * Используется для фото, которые пойдут в генерацию — сжатие снижает качество и похожесть.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ь: "",
  ъ: "",
}

function transliterateSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")

  let result = ""
  for (const char of normalized) {
    result += CYRILLIC_TO_LATIN[char] ?? char
  }

  return result
    .replace(/['"`]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildPortraitArchiveBaseName(fullName: string): string {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return "portrait"

  const surname = transliterateSegment(parts[0]) || "portrait"
  const initials = parts
    .slice(1)
    .map((part) => transliterateSegment(part))
    .filter(Boolean)
    .map((part) => part[0])
    .join("")

  return initials ? `${surname}-${initials}` : surname
}

export function ensureUniqueArchiveBaseName(baseName: string, usedNames: Set<string>): string {
  let candidate = baseName || "portrait"
  let suffix = 2

  while (usedNames.has(candidate)) {
    candidate = `${baseName}-${suffix}`
    suffix += 1
  }

  usedNames.add(candidate)
  return candidate
}

export function getImageDownloadExtension(url: string | null | undefined): string {
  if (!url) return "jpg"

  const dataUrlMatch = url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/)
  if (dataUrlMatch) {
    const format = dataUrlMatch[1].toLowerCase()
    if (format === "jpeg" || format === "jpg") return "jpg"
    if (format === "png") return "png"
    if (format === "webp") return "webp"
    return "jpg"
  }

  const normalizedUrl = url.split("?")[0]?.toLowerCase() ?? ""
  if (normalizedUrl.endsWith(".png")) return "png"
  if (normalizedUrl.endsWith(".webp")) return "webp"
  if (normalizedUrl.endsWith(".jpeg") || normalizedUrl.endsWith(".jpg")) return "jpg"

  return "jpg"
}
