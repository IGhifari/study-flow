'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarRange,
  ChevronsUpDown,
  Check,
  Plus,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Semester } from '@studyflow/shared';
import { listSemesters, activateSemester } from '@/lib/semester-client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarSemesterSelectorProps {
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarSemesterSelector({
  isCollapsed,
  onNavigate,
}: SidebarSemesterSelectorProps): React.JSX.Element {
  const router = useRouter();
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isActivating, setIsActivating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const res = await listSemesters('all');
      setSemesters(res.semesters);
      setActiveSemester(res.activeSemester);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat daftar semester.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to semester changes triggered from other components (e.g. Semesters management page)
  React.useEffect(() => {
    const handleSemesterChange = () => {
      loadData();
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [loadData]);

  const handleSelectSemester = async (sem: Semester) => {
    if (sem.isActive) {
      return;
    }

    if (sem.archivedAt) {
      setErrorMessage('Semester yang diarsipkan tidak dapat diaktifkan.');
      return;
    }

    setIsActivating(true);
    setErrorMessage(null);

    try {
      await activateSemester(sem.id);
      setActiveSemester(sem);
      setSemesters((prev) =>
        prev.map((s) => ({
          ...s,
          isActive: s.id === sem.id,
        }))
      );

      // 1. Dispatch custom event to notify all active client views to reload data
      window.dispatchEvent(
        new CustomEvent('studyflow:semester-changed', {
          detail: { semesterId: sem.id },
        })
      );

      // 2. Trigger Next.js server component refresh
      router.refresh();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Gagal mengubah semester aktif. Silakan coba lagi.'
      );
    } finally {
      setIsActivating(false);
    }
  };

  // View when sidebar is collapsed (Desktop Icon-only mode)
  if (isCollapsed) {
    return (
      <div className="flex justify-center py-2 px-1">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={
                    activeSemester
                      ? `Semester Aktif: ${activeSemester.name} (${activeSemester.academicYear})`
                      : 'Pilih Semester Aktif'
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <CalendarRange className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              {activeSemester ? (
                <div>
                  <p className="font-semibold">{activeSemester.name}</p>
                  <p className="text-[11px] text-muted-foreground">{activeSemester.academicYear}</p>
                </div>
              ) : (
                'Pilih Semester Aktif'
              )}
            </TooltipContent>
          </Tooltip>

          <DropdownMenuContent side="right" align="start" className="w-64">
            <DropdownMenuLabel>Pilih Semester Aktif</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {semesters.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                <p>Belum ada semester</p>
                <Link
                  href="/semesters"
                  onClick={onNavigate}
                  className="mt-1.5 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Semester
                </Link>
              </div>
            ) : (
              semesters.map((sem) => {
                const isArchived = Boolean(sem.archivedAt);
                return (
                  <DropdownMenuItem
                    key={sem.id}
                    disabled={isArchived || isActivating || sem.isActive}
                    onClick={() => handleSelectSemester(sem)}
                    className="flex items-center justify-between py-2 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className={`truncate text-xs ${sem.isActive ? 'font-semibold text-primary' : ''}`}>
                        {sem.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sem.academicYear} {isArchived ? '(Arsip)' : ''}
                      </p>
                    </div>
                    {sem.isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </DropdownMenuItem>
                );
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/semesters"
                onClick={onNavigate}
                className="flex items-center gap-2 cursor-pointer text-xs font-medium text-primary"
              >
                <Plus className="h-4 w-4" />
                <span>Kelola / Tambah Semester</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // View when sidebar is expanded or in mobile drawer
  return (
    <div className="px-3 py-2 border-b border-sidebar-border">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Semester Aktif
        </span>
        <Link
          href="/semesters"
          onClick={onNavigate}
          className="text-xs text-primary hover:underline font-medium"
        >
          Kelola
        </Link>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isActivating}
            aria-label="Pilih semester aktif"
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-60"
          >
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Memuat semester...</span>
                </div>
              ) : isActivating ? (
                <div className="flex items-center gap-2 py-0.5 text-xs text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Mengaktifkan...</span>
                </div>
              ) : activeSemester ? (
                <div>
                  <p className="truncate text-sm font-semibold text-sidebar-foreground leading-tight">
                    {activeSemester.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground leading-tight mt-0.5">
                    {activeSemester.academicYear}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Belum ada semester aktif</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[256px]">
          <DropdownMenuLabel>Pilih Semester Aktif</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {semesters.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              <p>Belum ada semester.</p>
              <Link
                href="/semesters"
                onClick={onNavigate}
                className="mt-1.5 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Semester
              </Link>
            </div>
          ) : (
            semesters.map((sem) => {
              const isArchived = Boolean(sem.archivedAt);
              return (
                <DropdownMenuItem
                  key={sem.id}
                  disabled={isArchived || isActivating || sem.isActive}
                  onClick={() => handleSelectSemester(sem)}
                  className={`flex items-center justify-between py-2 cursor-pointer ${
                    sem.isActive ? 'bg-primary/10 text-primary font-semibold' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className={`truncate text-xs ${sem.isActive ? 'font-semibold text-primary' : 'text-foreground'}`}>
                      {sem.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {sem.academicYear} {isArchived ? '(Arsip)' : ''}
                    </p>
                  </div>
                  {sem.isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </DropdownMenuItem>
              );
            })
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/semesters"
              onClick={onNavigate}
              className="flex items-center gap-2 cursor-pointer text-xs font-medium text-primary"
            >
              <Plus className="h-4 w-4" />
              <span>Kelola / Tambah Semester</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Visible Error Notification */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-2 flex items-start justify-between gap-1.5 rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger"
        >
          <div className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-danger/70 hover:text-danger"
            aria-label="Tutup pesan error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
