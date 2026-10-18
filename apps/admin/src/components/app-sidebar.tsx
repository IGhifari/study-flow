"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Activity,
  Shield,
  AlertTriangle,
  BookOpen,
  Files,
  ListTodo,
  FileText,
  CalendarClock,
  BrainCircuit,
  UserCog,
} from "lucide-react"

import { NavMain, type NavMainGroup, type NavMainItem } from "@/components/nav-main"
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

  const navGroups: NavMainGroup[] = [
    {
      label: "Operasional & Sistem",
      items: [
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
          title: "Materi Kuliah",
          url: "/materials",
          icon: FileText,
          isActive: pathname.startsWith("/materials"),
        },
        {
          title: "Pekerjaan",
          url: "/jobs",
          icon: Activity,
          isActive: pathname.startsWith("/jobs"),
        },
      ],
    },
    {
      label: "Data Akademik",
      items: [
        {
          title: "Mata Kuliah",
          url: "/courses",
          icon: BookOpen,
          isActive: pathname.startsWith("/courses"),
        },
        {
          title: "Tugas Kuliah",
          url: "/assignments",
          icon: ListTodo,
          isActive: pathname.startsWith("/assignments"),
        },
        {
          title: "Catatan",
          url: "/notes",
          icon: FileText,
          isActive: pathname.startsWith("/notes"),
        },
        {
          title: "Jadwal Kuliah",
          url: "/schedules",
          icon: CalendarClock,
          isActive: pathname.startsWith("/schedules"),
        },
        {
          title: "Kuis & Latihan",
          url: "/quizzes",
          icon: BrainCircuit,
          isActive: pathname.startsWith("/quizzes"),
        },
      ],
    },
  ]

  const navMain: NavMainItem[] = navGroups.flatMap((g) => g.items)

  const navSecondary = [
    {
      title: "Pekerjaan Gagal",
      url: "/jobs?status=FAILED",
      icon: AlertTriangle,
    },
    {
      title: "Profil & Keamanan",
      url: "/profile",
      icon: UserCog,
    },
  ]

  const currentUser = {
    name: user?.name || "Administrator",
    email: user?.email || "admin@studyflow.id",
    avatar: "",
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-sidebar-accent"
            >
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shadow-xs shrink-0">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden group-data-[state=collapsed]:hidden">
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
        <NavMain groups={navGroups} items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
