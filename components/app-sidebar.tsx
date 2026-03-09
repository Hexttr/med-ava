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
  LogOut,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
  const [loggingOut, setLoggingOut] = useState(false)

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

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } finally {
      window.location.assign("/login")
    }
  }

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
          {/* Свёрнутое состояние: аббревиатура */}
          <div className="hidden size-8 shrink-0 items-center justify-center rounded-none bg-sidebar-primary group-data-[collapsible=icon]:flex">
            <span className="text-xs font-bold tracking-tight text-sidebar-primary-foreground">PH</span>
          </div>
          {/* Развёрнутое состояние: название и название организации */}
          <div className="flex min-w-0 flex-col gap-2 group-data-[collapsible=icon]:hidden w-full">
            <div className="flex flex-col items-center gap-0 text-center">
              <span className="text-lg font-semibold tracking-tight text-sidebar-foreground leading-tight">PhotoHUB</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/60 leading-tight">ENTERPRISE</span>
            </div>
            <div className="mt-3 rounded-none border border-sidebar-border/60 bg-sidebar-accent/30 px-2.5 py-1.5">
              <p className="text-[11px] font-medium leading-tight text-sidebar-foreground/90 truncate" title={subtitle}>
                {subtitle}
              </p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="pt-4">
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
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Выйти"
            >
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <LogOut className="size-4" />
                <span>{loggingOut ? "Выход..." : "Выйти"}</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
