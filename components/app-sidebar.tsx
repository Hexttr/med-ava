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
      <SidebarHeader className="relative px-4 pt-5 pb-3">
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
        <Link href="/" className="block pr-8">
          <div className="hidden h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5 group-data-[collapsible=icon]:flex">
            <Image
              src="/nczd-logo-blue.png"
              alt="Логотип НМИЦ здоровья детей"
              width={28}
              height={28}
              className="size-7 object-contain"
            />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                  <Image
                    src="/nczd-logo-blue.png"
                    alt="Логотип НМИЦ здоровья детей"
                    width={44}
                    height={44}
                    className="h-11 w-auto object-contain"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2 text-center">
                <div className="space-y-0.5">
                  {INSTITUTION_NAME_LINES.map((line) => (
                    <p key={line} className="text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] text-sidebar-foreground">
                      {line}
                    </p>
                  ))}
                </div>
                <p className="mx-auto max-w-[15rem] text-xs leading-5 text-sidebar-foreground/72">
                  {SIDEBAR_SUBTITLE}
                </p>
              </div>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="pt-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    size="lg"
                    className="rounded-xl px-3"
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
      <SidebarSeparator className="mx-4 bg-white/10" />
      <SidebarFooter className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Настройки"
              className="rounded-xl px-3"
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
              className="rounded-xl px-3"
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
