import { getGeminiKey } from "@/lib/settings"
import { PageHeader } from "@/components/page-header"
import { GenerateClient } from "./generate-client"

export default async function GeneratePage() {
  const geminiKey = await getGeminiKey()

  return (
    <>
      <PageHeader
        title="Одиночная обработка"
        description="Загрузите фото для генерации медицинского и корпоративного портретов"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Генерация" }]}
      />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <GenerateClient hasApiKey={!!geminiKey} />
      </div>
    </>
  )
}
