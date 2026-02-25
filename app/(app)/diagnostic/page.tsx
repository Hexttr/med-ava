import { PageHeader } from "@/components/page-header"
import { DiagnosticClient } from "./diagnostic-client"

export default function DiagnosticPage() {
  return (
    <>
      <PageHeader
        title="Диагностика сети"
        description="Проверка прокси, портов и рекомендации для работы из РФ"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Диагностика" }]}
      />
      <div className="flex flex-1 flex-col px-6 py-6 md:px-10 md:py-8">
        <DiagnosticClient />
      </div>
    </>
  )
}
