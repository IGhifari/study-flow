"use client"

import * as React from "react"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavMainItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
}

export interface NavMainGroup {
  label: string
  items: NavMainItem[]
}

export function NavMain({
  items,
  groups,
}: {
  items?: NavMainItem[]
  groups?: NavMainGroup[]
}) {
  const effectiveGroups: NavMainGroup[] = groups || (items ? [{ label: "Menu Utama", items }] : [])

  return (
    <>
      {effectiveGroups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={item.isActive}
                    className={
                      item.isActive
                        ? "font-medium bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                        : ""
                    }
                  >
                    <Link href={item.url}>
                      {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
