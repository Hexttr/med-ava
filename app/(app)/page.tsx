import Link from "next/link"
import { UserCircle, Users, ImageIcon, Settings, ArrowRight, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { getGeminiKey } from "@/lib/settings"

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
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="group transition-colors hover:border-primary/30">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <UserCircle className="size-5 text-primary" />
              </div>
              <CardTitle className="mt-3 text-base">Одиночная обработка</CardTitle>
              <CardDescription>
                Загрузите одно фото и получите два стиля портрета: медицинский (белый халат) и корпоративный.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1 px-0 text-primary" asChild>
                <Link href="/generate">
                  Начать
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group transition-colors hover:border-primary/30">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent/10">
                <Users className="size-5 text-accent" />
              </div>
              <CardTitle className="mt-3 text-base">Пакетная обработка</CardTitle>
              <CardDescription>
                Загрузите несколько фото сотрудников сразу для массовой генерации портретов.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1 px-0 text-primary" asChild>
                <Link href="/batch">
                  Начать
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group transition-colors hover:border-primary/30">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <ImageIcon className="size-5 text-muted-foreground" />
              </div>
              <CardTitle className="mt-3 text-base">Галерея</CardTitle>
              <CardDescription>
                Просмотр всех сгенерированных портретов за сессию. Скачивание по одному или пакетом.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1 px-0 text-primary" asChild>
                <Link href="/gallery">
                  Открыть галерею
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Как это работает</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              {[
                { step: "01", title: "Загрузка", desc: "Прикрепите фото сотрудника в JPG или PNG" },
                { step: "02", title: "Анализ", desc: "Gemini анализирует фото и создаёт оптимальный промпт" },
                { step: "03", title: "Генерация", desc: "NanoBanano создаёт два варианта портрета" },
                { step: "04", title: "Результат", desc: "Скачайте портреты в медицинском и корпоративном стиле" },
              ].map((item) => (
                <div key={item.step} className="flex flex-col gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{item.step}</span>
                  <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
