"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Activity,
  Shield,
  Layers,
  FileText,
  HelpCircle,
  ShieldAlert,
} from "lucide-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAdminAuth } from "@/components/admin-auth-context"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useAdminAuth()

  const navMain = [
    {
      title: "Ringkasan",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard" || pathname === "/",
    },
    {
      title: "Pengguna",
      url: "/users",
      icon: Users,
      isActive: pathname.startsWith("/users"),
    },
    {
      title: "Pekerjaan",
      url: "/jobs",
      icon: Activity,
      isActive: pathname.startsWith("/jobs"),
    },
  ]

  const navPlatform = [
    {
      name: "Antrean BullMQ",
      url: "/jobs",
      icon: Layers,
    },
    {
      name: "Daftar Akun Mahasiswa",
      url: "/users",
      icon: Users,
    },
    {
      name: "Ringkasan Platform",
      url: "/dashboard",
      icon: FileText,
    },
  ]

  const navSecondary = [
    {
      title: "Audit Keamanan",
      url: "/dashboard",
      icon: ShieldAlert,
    },
    {
      title: "Bantuan & SLA",
      url: "/dashboard",
      icon: HelpCircle,
    },
  ]

  const currentUser = {
    name: user?.name || "Administrator",
    email: user?.email || "admin@studyflow.id",
    avatar: "",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-sidebar-accent"
            >
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs shrink-0">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold text-foreground">
                    StudyFlow Admin
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Panel Pengelola
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments items={navPlatform} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
