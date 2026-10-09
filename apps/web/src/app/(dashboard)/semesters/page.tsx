'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarRange,
  Plus,
  CheckCircle2,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  Layers,
  Search,
  Check,
} from 'lucide-react';
import { Semester } from '@studyflow/shared';
import {
  listSemesters,
  activateSemester,
  unarchiveSemester,
} from '@/lib/semester-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateSemesterDialog } from '@/components/semesters/create-semester-dialog';
import { EditSemesterDialog } from '@/components/semesters/edit-semester-dialog';
import { DeleteSemesterDialog } from '@/components/semesters/delete-semester-dialog';
import { ArchiveSemesterDialog } from '@/components/semesters/archive-semester-dialog';

export default function SemestersPage(): React.JSX.Element {
  const router = useRouter();
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);
  const [unarchivingId, setUnarchivingId] = React.useState<string | null>(null);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingSemester, setEditingSemester] = React.useState<Semester | null>(null);
  const [deletingSemester, setDeletingSemester] = React.useState<Semester | null>(null);
  const [archivingSemester, setArchivingSemester] = React.useState<Semester | null>(null);

  const fetchSemestersList = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await listSemesters(statusFilter);
      setSemesters(data.semesters);
      setActiveSemester(data.activeSemester);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar semester.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    fetchSemestersList();
  }, [fetchSemestersList]);

  // Listen to semester changes from sidebar or other views
  React.useEffect(() => {
    const handleSemesterChange = () => {
      fetchSemestersList(true);
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [fetchSemestersList]);

  const handleActivate = async (id: string) => {
    setActionError(null);
    setActivatingId(id);
    try {
      await activateSemester(id);
      await fetchSemestersList(true);
      window.dispatchEvent(
        new CustomEvent('studyflow:semester-changed', { detail: { semesterId: id } })
      );
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengaktifkan semester.');
    } finally {
      setActivatingId(null);
    }
  };

  const handleUnarchive = async (id: string) => {
    setActionError(null);
    setUnarchivingId(id);
    try {
      await unarchiveSemester(id);
      await fetchSemestersList(true);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memulihkan semester.');
    } finally {
      setUnarchivingId(null);
    }
  };

  // Filter client-side berdasarkan pencarian nama atau tahun ajaran
  const filteredSemesters = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return semesters;
    return semesters.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.academicYear.toLowerCase().includes(q)
    );
  }, [semesters, searchQuery]);

  const counts = React.useMemo(() => {
    const activeCount = semesters.filter((s) => s.isActive && !s.archivedAt).length;
    const archivedCount = semesters.filter((s) => Boolean(s.archivedAt)).length;
    return {
      all: semesters.length,
      active: activeCount,
      archived: archivedCount,
    };
  }, [semesters]);

  const hasFilter = Boolean(searchQuery.trim() || statusFilter !== 'all');

  const handleResetFilter = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <CalendarRange className="h-7 w-7 text-primary" aria-hidden="true" />
            Kelola Semester
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur periode perkuliahan, tentukan semester aktif utama, dan arsipkan riwayat perkuliahan lama.
          </p>
        </div>

        <Button
          onClick={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Semester</span>
        </Button>
      </div>

      {/* Global Action Error Banner */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* 2. Filter Bar: Status Tabs & Pencarian */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Buttons */}
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40" role="group" aria-label="Filter status semester">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Semua {statusFilter === 'all' ? `(${semesters.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Aktif
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('archived')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === 'archived'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Arsip
          </button>
        </div>

        {/* Input Pencarian */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau tahun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
            aria-label="Cari semester"
          />
        </div>
      </div>

      {/* 3. Konten & State Halaman */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      ) : errorMsg ? (
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Gagal Memuat Semester</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSemestersList()}
              className="w-fit"
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : filteredSemesters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarRange className="h-6 w-6" aria-hidden="true" />
          </div>

          {hasFilter ? (
            <>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Tidak ada semester yang cocok
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Tidak ditemukan semester yang sesuai dengan kata kunci atau filter status saat ini.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilter}
                className="mt-4"
              >
                Reset filter
              </Button>
            </>
          ) : statusFilter === 'archived' ? (
            <>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Tidak ada semester diarsipkan
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Semester yang telah Anda selesaikan dan arsipkan akan tercatat di sini.
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Belum ada semester
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Mulai tambahkan semester pertama Anda untuk mengelompokkan mata kuliah, materi, dan tugas belajar.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Semester Pertama</span>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-sm block md:table">
            <thead className="hidden md:table-header-group border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3.5">Nama Semester</th>
                <th scope="col" className="px-4 py-3.5">Tahun Ajaran</th>
                <th scope="col" className="px-4 py-3.5">Mata Kuliah Terkait</th>
                <th scope="col" className="px-4 py-3.5">Status</th>
                <th scope="col" className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group divide-y divide-border">
              {filteredSemesters.map((semester) => {
                const isArchived = Boolean(semester.archivedAt);
                const isCurrentActive = Boolean(semester.isActive && !isArchived);
                const isActivating = activatingId === semester.id;
                const isUnarchiving = unarchivingId === semester.id;

                return (
                  <tr
                    key={semester.id}
                    className={`flex flex-col p-4 space-y-2.5 md:space-y-0 md:table-row md:p-0 transition-colors group ${
                      isCurrentActive
                        ? 'bg-primary/[0.03] md:hover:bg-primary/[0.06]'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Nama Semester */}
                    <td className="p-0 md:px-4 md:py-3.5 block md:table-cell">
                      <div className="flex items-start md:items-center justify-between md:justify-start gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-foreground text-sm line-clamp-1">
                            {semester.name}
                          </span>
                        </div>

                        {/* Mobile Status Badge */}
                        <div className="md:hidden shrink-0">
                          {isCurrentActive ? (
                            <Badge variant="default" className="text-[10px] gap-1 bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" /> Aktif
                            </Badge>
                          ) : isArchived ? (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              Arsip
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Non-aktif
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tahun Ajaran */}
                    <td className="p-0 md:px-4 md:py-3.5 block md:table-cell whitespace-nowrap text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>{semester.academicYear}</span>
                      </div>
                    </td>

                    {/* Mata Kuliah Terkait */}
                    <td className="p-0 md:px-4 md:py-3.5 block md:table-cell whitespace-nowrap text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>
                          {typeof semester.courseCount === 'number'
                            ? `${semester.courseCount} Mata Kuliah`
                            : '0 Mata Kuliah'}
                        </span>
                      </div>
                    </td>

                    {/* Status (Desktop only, mobile has it in name cell) */}
                    <td className="hidden md:table-cell px-4 py-3.5 whitespace-nowrap">
                      {isCurrentActive ? (
                        <Badge variant="default" className="text-[11px] gap-1 bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" /> Aktif
                        </Badge>
                      ) : isArchived ? (
                        <Badge variant="secondary" className="text-[11px] text-muted-foreground">
                          Arsip
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          Non-aktif
                        </Badge>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="pt-2 md:pt-0 p-0 md:px-4 md:py-3.5 block md:table-cell border-t md:border-t-0 border-border/50 md:whitespace-nowrap md:text-right">
                      <div className="flex items-center justify-between md:justify-end gap-1.5">
                        {/* Tombol Jadikan Aktif */}
                        {!isArchived && !isCurrentActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleActivate(semester.id)}
                            disabled={isActivating}
                            className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                            title="Jadikan semester aktif"
                          >
                            {isActivating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span>Jadikan Aktif</span>
                          </Button>
                        ) : isCurrentActive ? (
                          <span className="text-xs font-medium text-primary hidden md:inline px-2">
                            Sedang Digunakan
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground hidden md:inline px-2">
                            Read-only
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {/* Tombol Edit */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSemester(semester)}
                            className="h-8 w-8 p-0"
                            title="Edit semester"
                            aria-label={`Edit semester ${semester.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {/* Tombol Arsip / Pulihkan */}
                          {isArchived ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnarchive(semester.id)}
                              disabled={isUnarchiving}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Pulihkan semester"
                              aria-label={`Pulihkan semester ${semester.name}`}
                            >
                              {isUnarchiving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setArchivingSemester(semester)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Arsipkan semester"
                              aria-label={`Arsipkan semester ${semester.name}`}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Tombol Hapus */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingSemester(semester)}
                            className="h-8 w-8 p-0 text-danger hover:bg-danger/10"
                            title="Hapus semester"
                            aria-label={`Hapus semester ${semester.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Dialogs */}
      <CreateSemesterDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={async () => {
          await fetchSemestersList(true);
          router.refresh();
        }}
      />

      <EditSemesterDialog
        semester={editingSemester}
        onOpenChange={(open) => !open && setEditingSemester(null)}
        onSuccess={async () => {
          await fetchSemestersList(true);
          router.refresh();
        }}
      />

      <ArchiveSemesterDialog
        semester={archivingSemester}
        onOpenChange={(open) => !open && setArchivingSemester(null)}
        onSuccess={async () => {
          await fetchSemestersList(true);
          router.refresh();
        }}
      />

      <DeleteSemesterDialog
        semester={deletingSemester}
        onOpenChange={(open) => !open && setDeletingSemester(null)}
        onSuccess={async () => {
          await fetchSemestersList(true);
          router.refresh();
        }}
      />
    </div>
  );
}
