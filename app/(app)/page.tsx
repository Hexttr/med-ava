import React from "react"
import Link from "next/link"
import {
  UserCircle,
  Users,
  Images,
  ArrowRight,
  AlertCircle,
  Settings,
  Upload,
  ScanSearch,
  Sparkles,
  Download,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { getGeminiKey } from "@/lib/settings"

const featureCards = [
  {
    title: "Одиночная обработка",
    description:
      "Загрузите одно фото и получите два стиля портрета: медицинский (белый халат) и корпоративный.",
    href: "/generate",
    label: "Начать",
    icon: UserCircle,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
  },
  {
    title: "Пакетная обработка",
    description: "Загрузите несколько фото сотрудников сразу для массовой генерации портретов.",
    href: "/batch",
    label: "Начать",
    icon: Users,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Галерея",
    description:
      "Просмотр всех сгенерированных портретов за сессию. Скачивание по одному или пакетом.",
    href: "/gallery",
    label: "Открыть галерею",
    icon: Images,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
] as const

const howItWorksSteps = [
  {
    step: "01",
    title: "Загрузка",
    description: "Прикрепите фото сотрудника в JPG или PNG",
    icon: Upload,
  },
  {
    step: "02",
    title: "Анализ",
    description: "Gemini анализирует фото и создаёт оптимальный промпт",
    icon: ScanSearch,
  },
  {
    step: "03",
    title: "Генерация",
    description: "NanoBanano создаёт два варианта портрета",
    icon: Sparkles,
  },
  {
    step: "04",
    title: "Результаты",
    description: "Скачайте портреты в медицинском и корпоративном стиле",
    icon: Download,
  },
] as const

export default async function DashboardPage() {
  const geminiKey = await getGeminiKey()
  const isConfigured = !!geminiKey

  return (
    <>
      <PageHeader
        title="Главная"
        description="Корпоративный генератор портретов — система генерации аватаров"
        breadcrumbs={[{ label: "EAM" }, { label: "Главная" }]}
      />
      <div className="flex flex-1 flex-col gap-10 p-4 md:p-6">
        {!isConfigured && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-foreground">API-ключ не настроен</p>
                  <p className="text-sm text-muted-foreground">
                    Добавьте ключ Gemini в настройках, чтобы начать генерацию портретов.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="mr-2 size-4" />
                  Открыть настройки
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Карточки возможностей */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((item) => {
            const Icon = item.icon
            return (
              <Card
                key={item.href}
                className="group border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-12 shrink-0 items-center justify-center rounded-none ${item.iconBg} ${item.iconColor}`}
                    >
                      <Icon className="size-6" />
                    </div>
                    <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    {item.label}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </section>

        {/* Панорамное изображение — медицинская тематика */}
        <section className="overflow-hidden rounded-none border border-border bg-muted/30">
          <img
            src="/medical-panorama.jpg"
            alt="Медицинская тематика"
            className="h-40 w-full object-cover object-center sm:h-52 md:h-64"
          />
        </section>

        {/* Как это работает */}
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="flex flex-col gap-6 p-5">
            <h2 className="text-center text-lg font-semibold text-foreground">Как это работает?</h2>
            <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-start">
            {howItWorksSteps.map((item, index) => {
              const Icon = item.icon
              const isLast = index === howItWorksSteps.length - 1
              return (
                <React.Fragment key={item.step}>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 gap-y-1 sm:gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-none bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <span className="shrink-0 font-mono text-2xl font-light tabular-nums text-muted-foreground">
                        {item.step}
                      </span>
                      <h3 className="min-w-0 shrink text-sm font-semibold text-foreground break-words">
                        {item.title}
                      </h3>
                    </div>
                    <p className="min-w-0 text-xs text-muted-foreground leading-relaxed break-words">
                      {item.description}
                    </p>
                  </div>
                  {!isLast && (
                    <div
                      className="mt-[2.75rem] hidden min-w-6 flex-1 border-t border-border md:block"
                      aria-hidden
                    />
                  )}
                </React.Fragment>
              )
            })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
