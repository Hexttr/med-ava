import { PageHeader } from "@/components/page-header"
import { GalleryClient } from "./gallery-client"

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        title="Галерея"
        description="Просмотр и скачивание сгенерированных портретов за сессию"
        breadcrumbs={[{ label: "EAM", href: "/" }, { label: "Галерея" }]}
      />
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <GalleryClient />
      </div>
    </>
  )
}
