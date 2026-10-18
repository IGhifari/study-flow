'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ThemeToggle } from '@/components/theme-toggle';
import { AdminCommandPalette, CommandPaletteTrigger } from '@/components/admin-command-palette';

export function AdminHeader() {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = React.useState(false);

  const isUserDetail = pathname.startsWith('/users/') && pathname !== '/users';

  const getPageTitle = (path: string) => {
    if (path === '/users') return 'Manajemen Pengguna';
    if (isUserDetail) return 'Detail Pengguna';
    if (path === '/materials') return 'Manajemen Materi PDF';
    if (path === '/jobs') return 'Monitoring Pekerjaan & Antrean';
    if (path === '/profile') return 'Profil & Keamanan Admin';
    if (path === '/courses') return 'Mata Kuliah';
    if (path === '/assignments') return 'Tugas Kuliah';
    if (path === '/notes') return 'Catatan Mahasiswa';
    if (path === '/schedules') return 'Jadwal Kuliah';
    if (path === '/quizzes') return 'Kuis & Latihan';
    if (path === '/dashboard' || path === '/') return 'Ringkasan Operasional';
    return 'Admin Control Center';
  };

  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-2 rounded-t-xl border-b border-border/60 bg-background/95 px-3 sm:px-4 backdrop-blur-xs transition-[width,height] ease-linear">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="mr-2 h-4 shrink-0" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden md:block text-muted-foreground shrink-0">
              StudyFlow Admin
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block shrink-0" />
            {isUserDetail ? (
              <>
                <BreadcrumbItem className="shrink-0">
                  <BreadcrumbLink asChild>
                    <Link href="/users">Pengguna</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="shrink-0" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate max-w-[120px] sm:max-w-none">Detail</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate max-w-[140px] sm:max-w-none">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <CommandPaletteTrigger onClick={() => setCommandOpen(true)} />
        <ThemeToggle />
      </div>

      <AdminCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
