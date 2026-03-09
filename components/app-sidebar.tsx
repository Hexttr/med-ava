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
  SidebarSeparator,
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

const INSTITUTION_NAME_LINES = [
  "Национальный медицинский",
  "исследовательский центр",
  "здоровья детей",
]
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
      <SidebarHeader className="relative px-4 pt-5 pb-4 group-data-[collapsible=icon]:px-3">
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
        <Link
          href="/"
          className="block pr-8 md:pr-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
        >
          <div className="hidden items-center justify-center group-data-[collapsible=icon]:flex">
            <Image
              src="/nczd-logo-blue.png"
              alt="Логотип НМИЦ здоровья детей"
              width={34}
              height={34}
              className="h-[34px] w-auto object-contain"
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="px-1">
              <div className="flex items-start gap-3">
                <Image
                  src="/nczd-logo-blue.png"
                  alt="Логотип НМИЦ здоровья детей"
                  width={48}
                  height={48}
                  className="mt-0.5 h-12 w-auto object-contain"
                />
                <div className="min-w-0 space-y-1.5">
                  <div className="space-y-0.5">
                    {INSTITUTION_NAME_LINES.map((line) => (
                      <p key={line} className="text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] text-sidebar-foreground">
                        {line}
                      </p>
                    ))}
                  </div>
                  <p className="max-w-[14.5rem] text-xs leading-5 text-sidebar-foreground/68">
                    {SIDEBAR_SUBTITLE}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Link>
        <div className="mt-4 h-px bg-white/10 group-data-[collapsible=icon]:mt-3" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="pt-1 group-data-[collapsible=icon]:px-0">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    size="lg"
                    className="relative h-11 rounded-xl px-3.5 text-[15px] text-sidebar-foreground/84 hover:bg-white/6 hover:text-sidebar-foreground data-[active=true]:bg-white/8 data-[active=true]:text-sidebar-foreground before:absolute before:left-0 before:top-2.5 before:h-6 before:w-0.5 before:rounded-full before:bg-transparent data-[active=true]:before:bg-sidebar-primary group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:before:hidden"
                  >
                    <Link href={item.href}>
                      <item.icon className="size-5 shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator className="mx-4 bg-white/10 group-data-[collapsible=icon]:mx-3" />
      <SidebarFooter className="pt-4 group-data-[collapsible=icon]:px-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Настройки"
              className="relative h-11 rounded-xl px-3.5 text-[15px] text-sidebar-foreground/84 hover:bg-white/6 hover:text-sidebar-foreground data-[active=true]:bg-white/8 data-[active=true]:text-sidebar-foreground before:absolute before:left-0 before:top-2.5 before:h-6 before:w-0.5 before:rounded-full before:bg-transparent data-[active=true]:before:bg-sidebar-primary group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:before:hidden"
            >
              <Link href="/settings">
                <Settings className="size-5 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">Настройки</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Выйти"
              className="h-11 rounded-xl px-3.5 text-[15px] text-red-200/90 hover:bg-red-500/10 hover:text-red-100 data-[active=true]:bg-red-500/10 data-[active=true]:text-red-100 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:px-0"
            >
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 text-inherit transition-colors disabled:opacity-50 group-data-[collapsible=icon]:justify-center"
              >
                <LogOut className="size-5 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">{loggingOut ? "Выход..." : "Выйти"}</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
