'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Files,
  FileText,
  LayoutDashboard,
  ListTodo,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { UserProfile } from '@studyflow/shared';
import { StudyFlowLogo } from '@/components/brand/studyflow-logo';
import { SidebarSemesterSelector } from './sidebar-semester-selector';
import { NavUser } from './nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const mainNavigationGroups: NavGroup[] = [
  {
    label: 'Belajar',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        label: 'Materi',
        href: '/materials',
        icon: Files,
      },
      {
        label: 'Tugas',
        href: '/assignments',
        icon: ListTodo,
      },
      {
        label: 'Catatan',
        href: '/notes',
        icon: FileText,
      },
    ],
  },
  {
    label: 'Perkuliahan',
    items: [
      {
        label: 'Mata Kuliah',
        href: '/courses',
        icon: BookOpen,
      },
      {
        label: 'Jadwal Kuliah',
        href: '/schedule',
        icon: CalendarClock,
      },
      {
        label: 'Kalender',
        href: '/calendar',
        icon: CalendarDays,
      },
    ],
  },
];

export const secondaryNavigationItems: NavItem[] = [
  {
    label: 'Kelola Semester',
    href: '/semesters',
    icon: CalendarRange,
  },
  {
    label: 'Pengaturan',
    href: '/settings',
    icon: Settings,
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProfile;
}

export function AppSidebar({ user, ...props }: AppSidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const { setOpenMobile, state, isMobile } = useSidebar();
  const isCollapsed = state === 'collapsed' && !isMobile;

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                href="/dashboard"
                onClick={() => setOpenMobile(false)}
                aria-label="StudyFlow Beranda"
              >
                <StudyFlowLogo subtitle="Ruang Belajar" hideTextOnCollapsed />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSemesterSelector
          isCollapsed={isCollapsed}
          onNavigate={() => setOpenMobile(false)}
        />
      </SidebarHeader>

      <SidebarContent>
        {mainNavigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!isCollapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpenMobile(false)}
                          aria-label={item.label}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          {!isCollapsed && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* NavSecondary anchored to bottom of SidebarContent per sidebar-08 */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      size="sm"
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
