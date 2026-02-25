import { Suspense } from "react"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Вход — PhotoHUB Enterprise",
  description: "Авторизация",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center gap-0">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-none bg-primary">
              <span className="text-lg font-bold tracking-tight text-primary-foreground">PH</span>
            </div>
            <div className="mt-3 flex flex-col items-center gap-0">
              <span className="text-xl font-semibold tracking-tight text-foreground leading-tight">PhotoHUB</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground leading-tight">ENTERPRISE</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Корпоративный генератор портретов</p>
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
