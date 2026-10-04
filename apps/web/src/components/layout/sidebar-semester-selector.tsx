'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarRange, ChevronDown, Plus, Check } from 'lucide-react';
import { Semester } from '@studyflow/shared';
import { listSemesters, activateSemester } from '@/lib/semester-client';

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
  const [isOpen, setIsOpen] = React.useState(false);
  const [isActivating, setIsActivating] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const res = await listSemesters('all');
      setSemesters(res.semesters);
      setActiveSemester(res.activeSemester);
    } catch {
      // Ignored in background
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectSemester = async (sem: Semester) => {
    if (sem.isActive || sem.archivedAt) {
      setIsOpen(false);
      return;
    }
    setIsActivating(true);
    try {
      await activateSemester(sem.id);
      await loadData();
      router.refresh();
    } catch (err) {
      console.error('Failed to activate semester:', err);
    } finally {
      setIsActivating(false);
      setIsOpen(false);
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex justify-center py-2">
        <Link
          href="/semesters"
          onClick={onNavigate}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={activeSemester ? `Semester Aktif: ${activeSemester.name}` : 'Kelola Semester'}
        >
          <CalendarRange className="h-5 w-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-sidebar-border">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Semester Aktif
        </span>
        <Link
          href="/semesters"
          onClick={onNavigate}
          className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
        >
          Kelola
        </Link>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isOpen}
          aria-label="Pilih semester aktif"
        >
          <div className="min-w-0 flex-1 pr-2">
            {isLoading ? (
              <span className="text-xs text-muted-foreground">Memuat...</span>
            ) : activeSemester ? (
              <div>
                <p className="truncate font-medium text-sidebar-foreground text-xs leading-tight">
                  {activeSemester.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {activeSemester.academicYear}
                </p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Belum ada semester aktif</span>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md">
            {semesters.length === 0 ? (
              <div className="p-2 text-center text-xs text-muted-foreground">
                <p>Belum ada semester.</p>
                <Link
                  href="/semesters"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate?.();
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Semester
                </Link>
              </div>
            ) : (
              semesters.map((sem) => {
                const isArchived = Boolean(sem.archivedAt);
                return (
                  <button
                    key={sem.id}
                    type="button"
                    disabled={isArchived || isActivating}
                    onClick={() => handleSelectSemester(sem)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      sem.isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : isArchived
                        ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate">{sem.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sem.academicYear} {isArchived ? '(Arsip)' : ''}
                      </p>
                    </div>
                    {sem.isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
