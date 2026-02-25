import { PageHeader } from "@/components/page-header"
import { DiagnosticClient } from "./diagnostic-client"

export default function DiagnosticPage() {
  return (
    <>
      <PageHeader
        title="Диагностика"
        description="Проверка прокси, портов, логи и мониторинг запросов к API"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Диагностика" }]}
      />
      <div className="flex flex-1 flex-col px-6 py-6 md:px-10 md:py-8">
        <DiagnosticClient />
      </div>
    </>
  )
}
