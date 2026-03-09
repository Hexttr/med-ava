import { Suspense } from "react"
import Image from "next/image"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Вход — PhotoHUB Enterprise",
  description: "Авторизация",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="rounded-3xl border border-border/70 bg-card/80 px-6 py-8 text-center shadow-sm backdrop-blur-sm md:px-10">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[1.75rem] border border-primary/18 bg-white shadow-md ring-2 ring-primary/14">
            <Image
              src="/nczd-logo-blue.png"
              alt="Логотип НМИЦ здоровья детей"
              width={96}
              height={96}
              className="h-20 w-auto object-contain"
              priority
            />
          </div>
          <div className="mx-auto mt-6 max-w-2xl space-y-3">
            <h1 className="text-2xl font-semibold leading-tight text-primary md:text-[2rem]">
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
