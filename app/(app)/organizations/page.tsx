import { PageHeader } from "@/components/page-header"
import { OrganizationsClient } from "./organizations-client"

export default function OrganizationsPage() {
  return (
    <>
      <PageHeader
        title="Организации"
        description="Управление организациями и списками сотрудников для генерации портретов"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Организации" }]}
      />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <OrganizationsClient />
      </div>
    </>
  )
}
