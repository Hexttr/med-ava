import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { PageHeader } from "@/components/page-header"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const [geminiKey, appSettings] = await Promise.all([getGeminiKey(), getAppSettings()])

  return (
    <>
      <PageHeader
        title="Настройки"
        description="API-ключи и параметры генерации"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Настройки" }]}
      />
      <div className="flex flex-1 flex-col gap-6 px-6 py-6 md:px-10 md:py-8">
        <SettingsForm
          hasKey={!!geminiKey}
          maskedKey={geminiKey ? maskKey(geminiKey) : null}
          appSettings={appSettings}
        />
      </div>
    </>
  )
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****"
  return key.slice(0, 4) + "..." + key.slice(-4)
}
