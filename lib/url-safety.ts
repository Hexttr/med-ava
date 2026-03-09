export function sanitizeAppRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//")) return fallback

  try {
    const url = new URL(value, "http://localhost")
    if (url.origin !== "http://localhost") return fallback
    return `${url.pathname}${url.search}${url.hash}` || fallback
  } catch {
    return fallback
  }
}
