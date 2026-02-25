"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  UserCircle,
  Users,
  Settings,
  LayoutDashboard,
  ImageIcon,
  Stethoscope,
  X,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"

const navItems = [
  {
    title: "Главная",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Одиночная обработка",
    href: "/generate",
    icon: UserCircle,
  },
  {
    title: "Пакетная обработка",
    href: "/batch",
    icon: Users,
  },
  {
    title: "Галерея",
    href: "/gallery",
    icon: ImageIcon,
  },
  {
    title: "Диагностика сети",
    href: "/diagnostic",
    icon: Stethoscope,
  },
]

const DEFAULT_SUBTITLE = "Корпоративный генератор портретов"

interface AppSidebarProps {
  initialOrganizationName?: string
}

export function AppSidebar({ initialOrganizationName }: AppSidebarProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { setOpenMobile } = useSidebar()
  const [subtitle, setSubtitle] = useState(
    initialOrganizationName?.trim() || DEFAULT_SUBTITLE
  )

  useEffect(() => {
    fetch("/api/settings/app")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.organizationName?.trim()) setSubtitle(data.organizationName.trim())
      })
      .catch(() => {})
  }, [])

  // Закрывать выдвижное меню на мобильных при переходе по ссылке
  useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative px-4 py-5">
        {isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 size-8"
            onClick={() => setOpenMobile(false)}
            aria-label="Закрыть меню"
          >
            <X className="size-5" />
          </Button>
        )}
        <Link href="/" className="flex items-center gap-3 pr-8">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-sm font-bold text-sidebar-primary-foreground">E</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground leading-none">EAM</span>
            <span className="text-[11px] text-sidebar-foreground/60 leading-tight">{subtitle}</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Настройки"
            >
              <Link href="/settings">
                <Settings className="size-4" />
                <span>Настройки</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
