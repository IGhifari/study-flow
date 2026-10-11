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
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '@studyflow/shared';
import { apiLogout } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SidebarSemesterSelector } from './sidebar-semester-selector';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
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

// Navigation groups categorized per specification
const navigationGroups = [
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
        label: 'Kelola Semester',
        href: '/semesters',
        icon: CalendarRange,
      },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      {
        label: 'Pengaturan',
        href: '/settings',
        icon: Settings,
      },
    ],
  },
];

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

  const isCollapsed = state === 'collapsed' && !isMobile;

  return (
    <>
      {/* Brand Header */}
      <SidebarHeader className="border-b border-sidebar-border h-16 justify-center">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden px-1"
          onClick={() => setOpenMobile(false)}
          aria-label="StudyFlow Beranda"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground truncate">
              StudyFlow
            </span>
          )}
        </Link>
      </SidebarHeader>

      {/* Active Semester Selector */}
      <SidebarSemesterSelector
        isCollapsed={isCollapsed}
        onNavigate={() => setOpenMobile(false)}
      />

      {/* Navigation Groups: Belajar, Perkuliahan, Pengaturan */}
      <SidebarContent className="py-2">
        {navigationGroups.map((group) => (
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
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {!isCollapsed && (
                            <span className="truncate text-sm">{item.label}</span>
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
      </SidebarContent>
    </>
  );
}

function HeaderBreadcrumbs(): React.JSX.Element {
  const pathname = usePathname();

  const items: { label: string; href?: string }[] = [];

  if (pathname === '/dashboard') {
    items.push({ label: 'Dashboard' });
  } else if (pathname === '/materials') {
    items.push({ label: 'Materi' });
  } else if (pathname.startsWith('/materials/')) {
    items.push({ label: 'Materi', href: '/materials' });
    items.push({ label: 'Detail Materi' });
  } else if (pathname === '/assignments') {
    items.push({ label: 'Tugas Kuliah' });
  } else if (pathname === '/notes') {
    items.push({ label: 'Catatan' });
  } else if (pathname.startsWith('/notes/')) {
    items.push({ label: 'Catatan', href: '/notes' });
    items.push({ label: 'Editor Catatan' });
  } else if (pathname === '/courses') {
    items.push({ label: 'Mata Kuliah' });
  } else if (pathname.startsWith('/courses/')) {
    items.push({ label: 'Mata Kuliah', href: '/courses' });
    items.push({ label: 'Detail Mata Kuliah' });
  } else if (pathname === '/semesters') {
    items.push({ label: 'Kelola Semester' });
  } else if (pathname === '/settings') {
    items.push({ label: 'Pengaturan' });
  } else {
    items.push({ label: 'StudyFlow' });
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden sm:inline-flex">
          <BreadcrumbLink asChild>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              StudyFlow
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={idx}>
              <BreadcrumbSeparator className={idx === 0 ? 'hidden sm:inline-flex' : undefined} />
              <BreadcrumbItem className="truncate">
                {isLast || !item.href ? (
                  <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className="text-muted-foreground hover:text-foreground truncate">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppShell({ user, children }: AppShellProps): React.JSX.Element {
  const router = useRouter();
  const [currentUser, setCurrentUser] = React.useState<UserProfile>(user);

  React.useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  React.useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<UserProfile>;
      if (customEvent.detail) {
        setCurrentUser(customEvent.detail);
      }
    };

    window.addEventListener('studyflow:profile-updated', handleProfileUpdated);
    return () => {
      window.removeEventListener('studyflow:profile-updated', handleProfileUpdated);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await apiLogout();
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* shadcn Sidebar with accessible drawer for <1024px & collapsible permanent sidebar for >=1024px */}
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarNavContent user={currentUser} />
          <SidebarRail />
        </Sidebar>

        {/* Main Content Area using shadcn SidebarInset */}
        <SidebarInset className="flex flex-col min-w-0">
          {/* Header (64px) per DESIGN.md section 7.1 */}
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur-xs sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4 shrink-0" />
              <div className="min-w-0 overflow-hidden">
                <HeaderBreadcrumbs />
              </div>
            </div>

            {/* Right Header: ThemeToggle & User Account Menu */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <ThemeToggle />
              <Separator orientation="vertical" className="h-4" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Menu akun untuk ${currentUser.name}`}
                    className="flex items-center gap-2 rounded-full p-1 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline-block max-w-[120px] truncate text-xs font-semibold text-foreground">
                      {currentUser.name}
                    </span>
                    <ChevronDown className="hidden md:inline-block h-3.5 w-3.5 text-muted-foreground opacity-70" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2.5 p-2">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{currentUser.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer text-xs flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Pengaturan Akun</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/semesters" className="cursor-pointer text-xs flex items-center gap-2">
                      <CalendarRange className="h-4 w-4" />
                      <span>Kelola Semester</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Keluar</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Dashboard Canvas - Max 1200px centered per DESIGN.md section 7.1 */}
          <div className="flex-1 p-3.5 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1200px]">{children}</div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
