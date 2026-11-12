'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { UserProfile } from '@studyflow/shared';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { GlobalSearchDialog } from '@/components/search/global-search-dialog';
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
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { AdminAuthProvider } from '@/components/admin/admin-auth-context';
import { AppSidebar as AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';

const AdminDashboardView = dynamic(() => import('@/components/admin/views/admin-dashboard-view'));
const AdminCoursesView = dynamic(() => import('@/components/admin/views/admin-courses-view'));
const AdminMaterialsView = dynamic(() => import('@/components/admin/views/admin-materials-view'));
const AdminAssignmentsView = dynamic(() => import('@/components/admin/views/admin-assignments-view'));
const AdminNotesView = dynamic(() => import('@/components/admin/views/admin-notes-view'));
const AdminSchedulesPage = dynamic(() => import('@/app/(dashboard)/schedules/page'));
const AdminProfilePage = dynamic(() => import('@/app/(dashboard)/profile/page'));

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
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
  } else if (pathname === '/schedule') {
    items.push({ label: 'Jadwal Kuliah' });
  } else if (pathname === '/calendar') {
    items.push({ label: 'Kalender' });
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

function renderAdminContent(pathname: string, children: React.ReactNode): React.ReactNode {
  if (pathname === '/dashboard') return <AdminDashboardView />;
  if (pathname === '/courses') return <AdminCoursesView />;
  if (pathname === '/materials') return <AdminMaterialsView />;
  if (pathname === '/assignments') return <AdminAssignmentsView />;
  if (pathname === '/notes') return <AdminNotesView />;
  if (pathname === '/schedule') return <AdminSchedulesPage />;
  if (pathname === '/settings') return <AdminProfilePage />;
  return children;
}

const ADMIN_ONLY_PREFIXES = ['/users', '/jobs', '/schedules', '/quizzes', '/profile'];

export function AppShell({ user, children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const isWidePage = Boolean(pathname?.startsWith('/materials/') && pathname !== '/materials');
  const [currentUser, setCurrentUser] = React.useState<UserProfile>(user);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const searchTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const isAdmin = currentUser.role === 'ADMIN';
  const isAdminOnlyRoute = Boolean(
    pathname && ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );

  React.useEffect(() => {
    if (!isAdmin && isAdminOnlyRoute) {
      router.replace('/dashboard');
    }
  }, [isAdmin, isAdminOnlyRoute, router]);

  React.useEffect(() => {
    if (isAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAdmin]);

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

  if (isAdmin) {
    return (
      <AdminAuthProvider initialUser={currentUser}>
        <SidebarProvider defaultOpen={true}>
          <AdminSidebar />
          <SidebarInset className="flex flex-col min-w-0">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3.5 focus:py-2 focus:text-xs focus:font-semibold focus:text-primary-foreground focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              Lewati ke konten utama
            </a>
            <AdminHeader />
            <main id="main-content" className="@container/main flex flex-1 flex-col" tabIndex={-1}>
              <div className="flex flex-1 flex-col">
                {renderAdminContent(pathname, children)}
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </AdminAuthProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar user={currentUser} />

      <SidebarInset className="flex flex-col min-w-0">
        {/* Skip to Content accessibility link per WCAG 2.1 & DESIGN.md section 13 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3.5 focus:py-2 focus:text-xs focus:font-semibold focus:text-primary-foreground focus:shadow-md focus:outline-hidden focus:ring-2 focus:ring-ring"
        >
          Lewati ke konten utama
        </a>

        {/* Header (64px) per sidebar-08 & DESIGN.md section 7.1 */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 rounded-t-xl border-b border-border/60 bg-background/95 px-4 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
            <div className="min-w-0 overflow-hidden">
              <HeaderBreadcrumbs />
            </div>
          </div>

          {/* Right Header: Global Search & ThemeToggle (NavUser is in SidebarFooter per sidebar-08) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              ref={searchTriggerRef}
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Pencarian global (Ctrl+K)"
              className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Cari...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                <span>⌘</span>K
              </kbd>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Main Dashboard Canvas - Max 1200px (or 1440px for wide materials split-view) centered per DESIGN.md section 7.1 */}
        <main id="main-content" className="flex-1 p-3.5 sm:p-6 lg:p-8" tabIndex={-1}>
          <div className={cn("mx-auto", isWidePage ? "max-w-[1440px]" : "max-w-[1200px]")}>
            {isAdminOnlyRoute ? null : children}
          </div>
        </main>
      </SidebarInset>

      {/* Global Search Dialog Modal */}
      <GlobalSearchDialog
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          searchTriggerRef.current?.focus();
        }}
      />
    </SidebarProvider>
  );
}
