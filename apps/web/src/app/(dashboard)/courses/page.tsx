'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Plus,
  Search,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  User,
  CalendarRange,
  ArrowRight,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import {
  Course,
  Semester,
} from '@studyflow/shared';
import {
  listCourses,
  archiveCourse,
  unarchiveCourse,
} from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RadixSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CreateCourseDialog } from '@/components/courses/create-course-dialog';
import { EditCourseDialog } from '@/components/courses/edit-course-dialog';
import { DeleteCourseDialog } from '@/components/courses/delete-course-dialog';

export default function CoursesPage(): React.JSX.Element {
  const router = useRouter();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);

  // Filters
  const [selectedSemesterId, setSelectedSemesterId] = React.useState<string>('all');
  const [isArchivedFilter, setIsArchivedFilter] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = React.useState<Course | null>(null);

  // Race condition protection
  const fetchRequestIdRef = React.useRef(0);

  // Load Semesters
  React.useEffect(() => {
    let isMounted = true;
    async function loadSemesters() {
      try {
        const semData = await listSemesters('all');
        if (!isMounted) return;
        setSemesters(semData.semesters);
        setActiveSemester(semData.activeSemester);
      } catch (err) {
        console.error('Failed to load semesters:', err);
      }
    }
    loadSemesters();

    const handleSemesterChange = () => {
      loadSemesters();
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);
    return () => {
      isMounted = false;
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, []);

  const fetchCoursesList = React.useCallback(
    async (silent = false) => {
      const currentRequestId = ++fetchRequestIdRef.current;
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMsg(null);
      setActionError(null);

      try {
        const data = await listCourses({
          semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
          isArchived: isArchivedFilter,
          search: searchQuery.trim() || undefined,
        });

        if (currentRequestId === fetchRequestIdRef.current) {
          setCourses(data.courses);
        }
      } catch (err: any) {
        if (currentRequestId === fetchRequestIdRef.current) {
          setErrorMsg(err.message || 'Gagal memuat daftar mata kuliah.');
        }
      } finally {
        if (currentRequestId === fetchRequestIdRef.current && !silent) {
          setIsLoading(false);
        }
      }
    },
    [selectedSemesterId, isArchivedFilter, searchQuery]
  );

  React.useEffect(() => {
    fetchCoursesList();
  }, [fetchCoursesList]);

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    setActionError(null);
    try {
      await archiveCourse(id);
      await fetchCoursesList(true);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengarsipkan mata kuliah.');
    } finally {
      setArchivingId(null);
    }
  };

  const handleUnarchive = async (id: string) => {
    setArchivingId(id);
    setActionError(null);
    try {
      await unarchiveCourse(id);
      await fetchCoursesList(true);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memulihkan mata kuliah.');
    } finally {
      setArchivingId(null);
    }
  };

  const nonArchivedSemesters = React.useMemo(
    () => semesters.filter((s) => !s.archivedAt),
    [semesters]
  );

  const hasFilter = Boolean(
    searchQuery.trim() || selectedSemesterId !== 'all' || isArchivedFilter
  );

  const handleResetFilter = () => {
    setSearchQuery('');
    setSelectedSemesterId('all');
    setIsArchivedFilter(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <BookOpen className="h-7 w-7 text-primary" aria-hidden="true" />
            <span>Mata Kuliah</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola daftar mata kuliah, dosen pengampu, dan keterhubungan materi perkuliahan.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          disabled={nonArchivedSemesters.length === 0}
          size="standard"
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah mata kuliah</span>
        </Button>
      </div>

      {/* Warning bila belum ada semester sama sekali */}
      {semesters.length === 0 && !isLoading && (
        <Alert variant="warning">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Belum ada semester dibuat</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>
              Mata kuliah membutuhkan semester untuk pengelompokan. Buat semester pertama Anda sebelum menambahkan mata kuliah.
            </span>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/semesters">
                Kelola Semester <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Global Action Error Banner */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* 2. Filter & Pencarian Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Semester Selector */}
          <div className="w-full sm:w-64">
            <RadixSelect
              value={selectedSemesterId}
              onValueChange={(val) => setSelectedSemesterId(val)}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Filter berdasarkan semester">
                <SelectValue placeholder="Semua Semester" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[320px]">
                <SelectItem value="all">Semua Semester</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '(Aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>
          </div>

          {/* Status Tab Toggle */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40" role="group" aria-label="Filter status arsip">
            <button
              type="button"
              onClick={() => setIsArchivedFilter(false)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                !isArchivedFilter
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setIsArchivedFilter(true)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isArchivedFilter
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Arsip
            </button>
          </div>
        </div>

        {/* Pencarian & Reset Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari mata kuliah atau kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
              aria-label="Cari mata kuliah atau kode"
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

      {/* 3. Konten / State Halaman */}
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
          <AlertTitle>Gagal Memuat Mata Kuliah</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCoursesList()}
              className="w-fit"
            >
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>

          {hasFilter ? (
            <>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Tidak ada mata kuliah yang cocok
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Tidak ditemukan mata kuliah untuk kriteria pencarian atau filter yang dipilih.
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
          ) : isArchivedFilter ? (
            <>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Tidak ada mata kuliah diarsipkan
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Mata kuliah yang Anda arsipkan setelah selesai semester akan muncul di sini.
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Belum ada mata kuliah
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Mulai tambahkan mata kuliah untuk semester Anda guna mengorganisasi materi, tugas, dan catatan belajar.
              </p>
              {nonArchivedSemesters.length > 0 && (
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  size="standard"
                  className="mt-4 inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah mata kuliah pertama</span>
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-sm block md:table">
            <thead className="hidden md:table-header-group border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3.5">Mata Kuliah</th>
                <th scope="col" className="px-4 py-3.5">Semester</th>
                <th scope="col" className="px-4 py-3.5">Dosen Pengampu</th>
                <th scope="col" className="px-4 py-3.5">Status</th>
                <th scope="col" className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group divide-y divide-border">
              {courses.map((course) => {
                const isArchived = Boolean(course.archivedAt);
                const isPending = archivingId === course.id;

                return (
                  <tr
                    key={course.id}
                    className="flex flex-col p-4 space-y-2.5 md:space-y-0 md:table-row md:p-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Nama & Kode */}
                    <td className="p-0 md:px-4 md:py-3.5 block md:table-cell max-w-[320px]">
                      <div className="flex items-start md:items-center justify-between md:justify-start gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <Link
                            href={`/courses/${course.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline transition-colors break-words"
                          >
                            {course.name}
                          </Link>
                          {course.code && (
                            <Badge variant="outline" className="font-mono text-[11px] shrink-0">
                              {course.code}
                            </Badge>
                          )}
                        </div>

                        {/* Mobile Status Badge */}
                        <div className="md:hidden shrink-0">
                          {isArchived ? (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              Arsip
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-[10px]">
                              Aktif
                            </Badge>
                          )}
                        </div>
                      </div>
                      {course.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground break-words">
                          {course.description}
                        </p>
                      )}
                    </td>

                    {/* Semester */}
                    <td className="p-0 md:px-4 md:py-3.5 block md:table-cell whitespace-nowrap text-xs text-muted-foreground">
                      {course.semester ? (
                        <div className="flex items-center gap-1.5">
                          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span>
                            {course.semester.name}
                            {course.semester.isActive ? ' (Aktif)' : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="hidden md:inline">—</span>
                      )}
                    </td>

                    {/* Dosen */}
                    <td className="p-0 md:px-4 md:py-3.5 block md:table-cell whitespace-nowrap text-xs text-muted-foreground">
                      {course.lecturer ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate max-w-[200px]">{course.lecturer}</span>
                        </div>
                      ) : (
                        <span className="hidden md:inline">—</span>
                      )}
                    </td>

                    {/* Status (Desktop only) */}
                    <td className="hidden md:table-cell px-4 py-3.5 whitespace-nowrap">
                      {isArchived ? (
                        <Badge variant="secondary" className="text-[11px] text-muted-foreground">
                          Arsip
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[11px]">
                          Aktif
                        </Badge>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="pt-2 md:pt-0 p-0 md:px-4 md:py-3.5 block md:table-cell border-t md:border-t-0 border-border/50 md:whitespace-nowrap md:text-right">
                      <div className="flex items-center justify-between md:justify-end gap-1.5">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                        >
                          <Link href={`/courses/${course.id}`}>
                            Detail
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground"
                              aria-label={`Menu aksi untuk mata kuliah "${course.name}"`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => setEditingCourse(course)}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              <span>Edit mata kuliah</span>
                            </DropdownMenuItem>

                            {isArchived ? (
                              <DropdownMenuItem
                                onClick={() => handleUnarchive(course.id)}
                                disabled={isPending}
                                className="cursor-pointer"
                              >
                                {isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                )}
                                <span>Pulihkan</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleArchive(course.id)}
                                disabled={isPending}
                                className="cursor-pointer"
                              >
                                {isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Archive className="h-4 w-4 mr-2" />
                                )}
                                <span>Arsipkan</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setDeletingCourse(course)}
                              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              <span>Hapus mata kuliah</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog Tambah Mata Kuliah */}
      <CreateCourseDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        semesters={semesters}
        activeSemesterId={activeSemester?.id}
        onSuccess={async () => {
          await fetchCoursesList(true);
          router.refresh();
        }}
      />

      {/* Dialog Edit Mata Kuliah */}
      <EditCourseDialog
        open={Boolean(editingCourse)}
        onOpenChange={(open) => !open && setEditingCourse(null)}
        course={editingCourse}
        onSuccess={async () => {
          await fetchCoursesList(true);
          router.refresh();
        }}
      />

      {/* Dialog Hapus Mata Kuliah */}
      <DeleteCourseDialog
        open={Boolean(deletingCourse)}
        onOpenChange={(open) => !open && setDeletingCourse(null)}
        course={deletingCourse}
        onSuccess={async () => {
          await fetchCoursesList(true);
          router.refresh();
        }}
      />
    </div>
  );
}
