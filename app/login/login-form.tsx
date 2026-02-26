"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Lock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [csrfToken, setCsrfToken] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.token && setCsrfToken(d.token))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || !csrfToken) {
      toast.error("Заполните поле пароля")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: password.trim(), csrfToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success("Вход выполнен")
        const redirect = searchParams.get("redirect") || "/"
        router.push(redirect)
        router.refresh()
      } else {
        toast.error(data.error || "Неверный пароль")
        setPassword("")
      }
    } catch {
      toast.error("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Вход</CardTitle>
        <CardDescription>Введите пароль для доступа</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              disabled={loading}
              className="font-mono"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !csrfToken}>
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Lock className="mr-2 size-4" />
            )}
            Войти
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
