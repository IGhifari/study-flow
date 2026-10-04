'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  LayoutDashboard,
  Settings,
  LogOut,
  CalendarRange,
  ListTodo,
  FileText,
  Files,
} from 'lucide-react';
import { UserProfile } from '@studyflow/shared';
import { apiLogout } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { SidebarSemesterSelector } from './sidebar-semester-selector';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
}

function SidebarNavContent({ user }: { user: UserProfile }): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, state, isMobile } = useSidebar();

  const handleLogout = async () => {
    try {
      await apiLogout();
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      isActive: pathname === '/dashboard',
    },
    {
      label: 'Materi',
      href: '/materials',
      icon: Files,
      isActive: pathname.startsWith('/materials'),
    },
    {
      label: 'Tugas',
      href: '/assignments',
      icon: ListTodo,
      isActive: pathname.startsWith('/assignments'),
    },
    {
      label: 'Catatan',
      href: '/notes',
      icon: FileText,
      isActive: pathname.startsWith('/notes'),
    },
    {
      label: 'Mata Kuliah',
      href: '/courses',
      icon: BookOpen,
      isActive: pathname.startsWith('/courses'),
    },
    {
      label: 'Kelola Semester',
      href: '/semesters',
      icon: CalendarRange,
      isActive: pathname.startsWith('/semesters'),
    },
    {
      label: 'Pengaturan',
      href: '/settings',
      icon: Settings,
      isActive: pathname.startsWith('/settings'),
    },
  ];

  const isCollapsed = state === 'collapsed' && !isMobile;

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border h-16 justify-center">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden px-1"
          onClick={() => setOpenMobile(false)}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground truncate">
              StudyFlow
            </span>
          )}
        </Link>
      </SidebarHeader>

      {/* Active Semester Selector per DESIGN.md section 7.1 */}
      <SidebarSemesterSelector
        isCollapsed={isCollapsed}
        onNavigate={() => setOpenMobile(false)}
      />

      <SidebarContent className="py-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpenMobile(false)}
                  className="w-full block"
                >
                  <SidebarMenuButton
                    isActive={item.isActive}
                    aria-current={item.isActive ? 'page' : undefined}
                    title={isCollapsed ? item.label : undefined}
                    className={isCollapsed ? 'justify-center px-0' : ''}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={`w-full text-danger-foreground hover:bg-danger/20 ${
            isCollapsed ? 'justify-center px-0' : 'justify-start'
          }`}
          title={isCollapsed ? 'Keluar' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="ml-2">Keluar</span>}
        </Button>
      </SidebarFooter>
    </>
  );
}

export function AppShell({ user, children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname();

  const getBreadcrumbTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/materials') return 'Materi PDF';
    if (pathname.startsWith('/materials/')) return 'Detail Materi';
    if (pathname === '/assignments') return 'Tugas Kuliah';
    if (pathname === '/notes') return 'Catatan Belajar';
    if (pathname.startsWith('/notes/')) return 'Editor Catatan';
    if (pathname === '/semesters') return 'Kelola Semester';
    if (pathname === '/courses') return 'Mata Kuliah';
    if (pathname.startsWith('/courses/')) return 'Detail Mata Kuliah';
    if (pathname.startsWith('/settings')) return 'Pengaturan Akun';
    return 'StudyFlow';
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* shadcn Sidebar with accessible drawer for <1024px & collapsible permanent sidebar for >=1024px */}
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarNavContent user={user} />
          <SidebarRail />
        </Sidebar>

        {/* Main Content Area using shadcn SidebarInset */}
        <SidebarInset className="flex flex-col min-w-0">
          {/* Header (64px) per DESIGN.md section 7.1 */}
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-xs sm:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-4 w-px bg-border" aria-hidden="true" />
              <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">StudyFlow</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium text-foreground">{getBreadcrumbTitle()}</span>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          {/* Main Dashboard Canvas - Max 1200px centered per DESIGN.md section 7.1 */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1200px]">
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
