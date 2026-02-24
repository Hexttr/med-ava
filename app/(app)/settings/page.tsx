import { getGeminiKey } from "@/lib/settings"
import { PageHeader } from "@/components/page-header"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const geminiKey = await getGeminiKey()

  return (
    <>
      <PageHeader
        title="Настройки"
        description="API-ключи и параметры генерации"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Настройки" }]}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <SettingsForm hasKey={!!geminiKey} maskedKey={geminiKey ? maskKey(geminiKey) : null} />
      </div>
    </>
  )
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****"
  return key.slice(0, 4) + "..." + key.slice(-4)
}
