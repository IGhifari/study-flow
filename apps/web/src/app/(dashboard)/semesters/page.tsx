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
  MoreVertical,
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
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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

  const hasFilter = Boolean(searchQuery.trim() || statusFilter !== 'all');

  const handleResetFilter = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return (
    <FadeIn className="space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <CalendarRange className="h-7 w-7 text-primary" aria-hidden="true" />
            <span>Kelola Semester</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur periode perkuliahan, tentukan semester aktif utama, dan arsipkan riwayat lama.
          </p>
        </div>

        <Button
          onClick={() => {
            setActionError(null);
            setIsCreateOpen(true);
          }}
          size="standard"
          className="gap-1.5 shrink-0 self-start sm:self-auto"
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
        {/* Status Filter Tabs */}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'archived')}
        >
          <TabsList aria-label="Filter status semester">
            <TabsTrigger value="all" className="text-xs px-3">
              Semua {statusFilter === 'all' ? `(${semesters.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs px-3">
              Aktif
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs px-3">
              Arsip
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Input Pencarian & Reset Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau tahun..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
              aria-label="Cari semester"
            />
          </div>
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilter}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
              title="Reset filter"
              aria-label="Reset filter pencarian"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* 3. Konten & State Halaman */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="hidden md:block rounded-xl border border-border bg-card p-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="grid gap-3 md:hidden">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
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
                size="standard"
                className="mt-4 inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Semester Pertama</span>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <Card className="hidden md:block overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase text-muted-foreground">
                    Nama Semester
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase text-muted-foreground">
                    Tahun Ajaran
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase text-muted-foreground">
                    Mata Kuliah Terkait
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-semibold uppercase text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSemesters.map((semester) => {
                  const isArchived = Boolean(semester.archivedAt);
                  const isCurrentActive = Boolean(semester.isActive && !isArchived);
                  const isActivating = activatingId === semester.id;
                  const isUnarchiving = unarchivingId === semester.id;

                  return (
                    <TableRow
                      key={semester.id}
                      className={
                        isCurrentActive
                          ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
                          : 'hover:bg-muted/30'
                      }
                    >
                      {/* Nama Semester */}
                      <TableCell className="px-4 py-3.5">
                        <span className="font-semibold text-foreground text-sm break-words">
                          {semester.name}
                        </span>
                      </TableCell>

                      {/* Tahun Ajaran */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="tabular-nums">{semester.academicYear}</span>
                        </div>
                      </TableCell>

                      {/* Mata Kuliah Terkait */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="tabular-nums">
                            {typeof semester.courseCount === 'number'
                              ? `${semester.courseCount} Mata Kuliah`
                              : '0 Mata Kuliah'}
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap">
                        {isCurrentActive ? (
                          <Badge variant="default" className="text-xs gap-1 bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" /> Aktif
                          </Badge>
                        ) : isArchived ? (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">
                            Arsip
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Non-aktif
                          </Badge>
                        )}
                      </TableCell>

                      {/* Aksi */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isArchived && !isCurrentActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleActivate(semester.id)}
                              disabled={Boolean(activatingId)}
                              className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                              title="Jadikan semester aktif"
                            >
                              {isActivating ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Mengaktifkan...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                  <span>Jadikan Aktif</span>
                                </>
                              )}
                            </Button>
                          ) : isCurrentActive ? (
                            <span className="text-xs font-medium text-primary px-2">
                              Sedang Digunakan
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground px-2">
                              Hanya-Baca
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                aria-label={`Menu aksi untuk semester "${semester.name}"`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => setEditingSemester(semester)}
                                className="cursor-pointer"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                <span>Edit semester</span>
                              </DropdownMenuItem>

                              {isArchived ? (
                                <DropdownMenuItem
                                  onClick={() => handleUnarchive(semester.id)}
                                  disabled={isUnarchiving}
                                  className="cursor-pointer"
                                >
                                  {isUnarchiving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                  )}
                                  <span>Pulihkan</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setArchivingSemester(semester)}
                                  className="cursor-pointer"
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  <span>Arsipkan</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => setDeletingSemester(semester)}
                                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                <span>Hapus semester</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Card List (< 768px) */}
          <StaggerGroup className="grid gap-3 md:hidden">
            {filteredSemesters.map((semester) => {
              const isArchived = Boolean(semester.archivedAt);
              const isCurrentActive = Boolean(semester.isActive && !isArchived);
              const isActivating = activatingId === semester.id;
              const isUnarchiving = unarchivingId === semester.id;

              return (
                <StaggerItem key={semester.id}>
                  <Card
                    className={`shadow-xs transition-colors ${
                      isCurrentActive
                        ? 'border-primary/30 bg-primary/[0.03]'
                        : ''
                    }`}
                  >
                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
                      <span className="font-semibold text-foreground text-sm break-words">
                        {semester.name}
                      </span>
                      <div className="shrink-0">
                        {isCurrentActive ? (
                          <Badge variant="default" className="text-xs gap-1 bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" /> Aktif
                          </Badge>
                        ) : isArchived ? (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">
                            Arsip
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Non-aktif
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="px-4 py-2 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="tabular-nums">{semester.academicYear}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="tabular-nums">
                          {typeof semester.courseCount === 'number'
                            ? `${semester.courseCount} Mata Kuliah`
                            : '0 Mata Kuliah'}
                        </span>
                      </div>
                    </CardContent>

                    <CardFooter className="p-4 pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
                      {!isArchived && !isCurrentActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivate(semester.id)}
                          disabled={Boolean(activatingId)}
                          className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5 text-primary border-primary/30 hover:bg-primary/10 relative after:absolute after:-inset-1 sm:after:hidden touch-manipulation"
                          title="Jadikan semester aktif"
                        >
                          {isActivating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Mengaktifkan...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              <span>Jadikan Aktif</span>
                            </>
                          )}
                        </Button>
                      ) : isCurrentActive ? (
                        <span className="text-xs font-medium text-primary px-2">
                          Sedang Digunakan
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground px-2">
                          Hanya-Baca
                        </span>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground"
                            aria-label={`Menu aksi untuk semester "${semester.name}"`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => setEditingSemester(semester)}
                            className="cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            <span>Edit semester</span>
                          </DropdownMenuItem>

                          {isArchived ? (
                            <DropdownMenuItem
                              onClick={() => handleUnarchive(semester.id)}
                              disabled={isUnarchiving}
                              className="cursor-pointer"
                            >
                              {isUnarchiving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4 mr-2" />
                              )}
                              <span>Pulihkan</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setArchivingSemester(semester)}
                              className="cursor-pointer"
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              <span>Arsipkan</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setDeletingSemester(semester)}
                            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Hapus semester</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardFooter>
                  </Card>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
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
    </FadeIn>
  );
}
