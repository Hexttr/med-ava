import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { getAppSettings } from "@/lib/app-settings"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { organizationName } = getAppSettings()
  return (
    <SidebarProvider>
      <AppSidebar initialOrganizationName={organizationName} />
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
