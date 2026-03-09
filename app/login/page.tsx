import { Suspense } from "react"
import Image from "next/image"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Вход — PhotoHUB Enterprise",
  description: "Авторизация",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/nczd-logo-blue.png"
            alt="Логотип НМИЦ здоровья детей"
            width={88}
            height={88}
            className="h-20 w-auto"
            priority
          />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold leading-tight text-primary md:text-2xl">
              Национальный медицинский исследовательский центр здоровья детей
            </h1>
            <p className="text-sm text-muted-foreground md:text-base">Корпоративный генератор портретов</p>
          </div>
        </div>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
