import { getGeminiKey } from "@/lib/settings"
import { getAppSettings } from "@/lib/app-settings"
import { getPromptDefaults } from "@/lib/prompts"
import { PageHeader } from "@/components/page-header"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const [geminiKey, appSettings] = await Promise.all([getGeminiKey(), getAppSettings()])
  const defaults = getPromptDefaults()
  // Показываем в форме фактические значения: из БД или по умолчанию
  const displaySettings = {
    ...appSettings,
    promptAnalysis: appSettings.promptAnalysis || defaults.promptAnalysis,
    promptUniversalFraming: appSettings.promptUniversalFraming || defaults.promptUniversalFraming,
    promptMedicalInstruction: appSettings.promptMedicalInstruction || defaults.promptMedicalInstruction,
    promptCorporateInstruction: appSettings.promptCorporateInstruction || defaults.promptCorporateInstruction,
    promptNegative: appSettings.promptNegative || defaults.promptNegative,
  }

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
          appSettings={displaySettings}
        />
      </div>
    </>
  )
}

