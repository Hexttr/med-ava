"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
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

const INSTITUTION_NAME = "Национальный медицинский исследовательский центр здоровья детей"
const SIDEBAR_SUBTITLE = "Корпоративный генератор портретов"

export function AppSidebar() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const { setOpenMobile } = useSidebar()
  const [loggingOut, setLoggingOut] = useState(false)

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
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-none border border-sidebar-border/60 bg-white group-data-[collapsible=icon]:flex">
            <Image
              src="/nczd-logo-blue.png"
              alt="Логотип НМИЦ здоровья детей"
              width={24}
              height={24}
              className="size-6 object-contain"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 group-data-[collapsible=icon]:hidden w-full">
            <div className="flex items-start gap-3 rounded-none border border-sidebar-border/60 bg-sidebar-accent/20 px-3 py-3">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-none border border-sidebar-border/60 bg-white">
                <Image
                  src="/nczd-logo-blue.png"
                  alt="Логотип НМИЦ здоровья детей"
                  width={40}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold leading-tight text-sidebar-foreground">
                  {INSTITUTION_NAME}
                </p>
                <p className="text-[11px] leading-tight text-sidebar-foreground/70">
                  {SIDEBAR_SUBTITLE}
                </p>
              </div>
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
