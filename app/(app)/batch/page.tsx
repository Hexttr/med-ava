import { getGeminiKey } from "@/lib/settings"
import { PageHeader } from "@/components/page-header"
import { BatchClient } from "./batch-client"

export default async function BatchPage() {
  const geminiKey = await getGeminiKey()

  return (
    <>
      <PageHeader
        title="Пакетная обработка"
        description="Загрузка нескольких фото для массовой генерации портретов"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Пакетная" }]}
      />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <BatchClient hasApiKey={!!geminiKey} />
      </div>
    </>
  )
}
