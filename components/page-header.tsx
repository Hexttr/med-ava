import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SidebarTrigger className="-ml-1 shrink-0 min-h-11 min-w-11 touch-manipulation md:min-h-0 md:min-w-0 md:size-7" aria-label="Открыть меню" />
        <Separator orientation="vertical" className="h-5" />
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <span key={index} className="contents">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </span>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground md:text-2xl">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 pt-2 md:pt-0">{actions}</div>}
      </div>
    </header>
  )
}
