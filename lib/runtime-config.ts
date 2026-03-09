const PROD = process.env.NODE_ENV === "production"

export function isAuthEnabled(): boolean {
  return Boolean(process.env.EAM_PASSWORD?.trim())
}

export function getPublicUrl(): string | null {
  const value = process.env.EAM_PUBLIC_URL?.trim()
  return value || null
}

export function isHttpsEnabled(): boolean {
  return process.env.EAM_HTTPS === "true"
}

export function getSessionSecret(): string {
  const secret = process.env.EAM_SESSION_SECRET?.trim()
  if (secret) return secret

  if (!PROD) {
    return "eam-dev-session-secret"
  }

  throw new Error("EAM_SESSION_SECRET is required in production")
}

export function getRuntimeConfigIssues(): string[] {
  const issues: string[] = []
  const publicUrl = getPublicUrl()

  if (isAuthEnabled() && PROD && !process.env.EAM_SESSION_SECRET?.trim()) {
    issues.push("EAM_SESSION_SECRET is missing")
  }

  if (publicUrl) {
    try {
      const url = new URL(publicUrl)
      if (isHttpsEnabled() && url.protocol !== "https:") {
        issues.push("EAM_HTTPS=true requires an https EAM_PUBLIC_URL")
      }
      if (!isHttpsEnabled() && url.protocol === "https:") {
        issues.push("EAM_PUBLIC_URL uses https but EAM_HTTPS is not enabled")
      }
    } catch {
      issues.push("EAM_PUBLIC_URL is invalid")
    }
  } else if (PROD) {
    issues.push("EAM_PUBLIC_URL is missing")
  }

  return issues
}
