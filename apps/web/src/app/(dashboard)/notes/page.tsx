'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  Calendar,
  Pencil,
  Trash2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  MoreVertical,
  Pin,
  Loader2,
} from 'lucide-react';
import {
  NoteListItem,
  Course,
  Semester,
  UserProfile,
  formatUserDateTime,
  Note,
} from '@studyflow/shared';
import { listNotes } from '@/lib/note-client';
import { pinNote } from '@/lib/pin-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RadixSelect as Select,
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
import { CreateNoteDialog } from '@/components/notes/create-note-dialog';
import { DeleteNoteDialog } from '@/components/notes/delete-note-dialog';

export default function NotesPage(): React.JSX.Element {
  const router = useRouter();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [activeSemester, setActiveSemester] = React.useState<Semester | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>('ALL');

  // Page States
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [deletingNote, setDeletingNote] = React.useState<NoteListItem | null>(null);
  const [pinningId, setPinningId] = React.useState<string | null>(null);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Race condition protection
  const fetchRequestIdRef = React.useRef(0);

  // Load initial metadata: Profile, Courses & Semester
  React.useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [profile, courseRes, semesterRes] = await Promise.all([
          getProfile().catch(() => null),
          listCourses().catch(() => ({ courses: [] })),
          listSemesters().catch(() => ({ semesters: [], activeSemester: null, activeSemesterId: null })),
        ]);
        if (!isMounted) return;
        if (profile) setUserProfile(profile);
        setCourses(courseRes.courses);
        if (semesterRes?.activeSemester) setActiveSemester(semesterRes.activeSemester);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchNotesList = React.useCallback(
    async (silent = false) => {
      const currentRequestId = ++fetchRequestIdRef.current;
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMsg(null);

      try {
        const data = await listNotes({
          courseId: selectedCourseId === 'ALL' ? undefined : selectedCourseId,
          search: searchQuery.trim() || undefined,
          limit: 100,
        });

        if (currentRequestId === fetchRequestIdRef.current) {
          setNotes(data.notes);
        }
      } catch (err: any) {
        if (currentRequestId === fetchRequestIdRef.current) {
          setErrorMsg(err.message || 'Gagal memuat catatan belajar.');
        }
      } finally {
        if (currentRequestId === fetchRequestIdRef.current && !silent) {
          setIsLoading(false);
        }
      }
    },
    [selectedCourseId, searchQuery]
  );

  React.useEffect(() => {
    fetchNotesList();
  }, [fetchNotesList]);

  // Semester change listener
  React.useEffect(() => {
    const handleSemesterChange = () => {
      listCourses().then((res) => setCourses(res.courses)).catch(() => {});
      listSemesters().then((res) => setActiveSemester(res.activeSemester)).catch(() => {});
      fetchNotesList(true);
    };
    window.addEventListener('studyflow:semester-changed', handleSemesterChange);

    return () => {
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, [fetchNotesList]);

  const activeCourses = React.useMemo(
    () => courses.filter((c) => !c.archivedAt),
    [courses]
  );

  const handleTogglePin = async (note: NoteListItem) => {
    if (pinningId === note.id) return;
    const nextPinned = !note.isPinned;
    setPinningId(note.id);

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, isPinned: nextPinned } : n))
    );

    try {
      await pinNote(note.id, nextPinned);
    } catch (err: any) {
      // Rollback on failure
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, isPinned: note.isPinned } : n))
      );
      setErrorMsg(err.message || 'Gagal memperbarui status sematan catatan');
    } finally {
      setPinningId(null);
    }
  };

  const hasFilter = Boolean(searchQuery || selectedCourseId !== 'ALL');

  const handleResetFilter = () => {
    setSearchQuery('');
    setSelectedCourseId('ALL');
  };

  const handleNoteCreated = (created: Note) => {
    router.push(`/notes/${created.id}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5 sm:pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            Catatan
          </h1>
          <div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            {activeSemester ? (
              <>
                <span className="font-medium text-foreground">
                  {activeSemester.name.toLowerCase().includes(activeSemester.academicYear.toLowerCase())
                    ? activeSemester.name
                    : `${activeSemester.name} (${activeSemester.academicYear})`}
                </span>
                <span>•</span>
              </>
            ) : null}
            <span>{notes.length} catatan terdaftar</span>
          </div>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          disabled={activeCourses.length === 0}
          size="standard"
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Buat catatan</span>
        </Button>
      </div>

      {/* Warning banner jika belum ada mata kuliah aktif */}
      {activeCourses.length === 0 && !isLoading && (
        <Alert variant="warning">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Belum ada mata kuliah aktif</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>
              Anda perlu menambahkan mata kuliah aktif terlebih dahulu sebelum dapat membuat catatan belajar.
            </span>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/courses">Kelola Mata Kuliah &rarr;</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 2. Pencarian dan Filter Toolbar Terpadu */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Input Pencarian */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari judul catatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Filter Mata Kuliah */}
            <div className="w-full sm:w-[240px]">
              <Select
                value={selectedCourseId}
                onValueChange={(val) => setSelectedCourseId(val)}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Semua Mata Kuliah" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[320px]">
                  <SelectItem value="ALL">Semua Mata Kuliah</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''} {c.archivedAt ? '[Arsip]' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filter Button */}
            {hasFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilter}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 self-start sm:self-auto"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                <span>Hapus filter</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Daftar Catatan & State Views */}
      {isLoading ? (
        /* Loading Skeleton State */
        <div className="space-y-3" data-testid="notes-skeleton">
          {/* Skeleton Desktop Table */}
          <div className="hidden md:block rounded-xl border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
          {/* Skeleton Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      ) : errorMsg ? (
        /* Error State with Retry Button */
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Terjadi kesalahan saat memuat catatan</AlertTitle>
          <AlertDescription className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{errorMsg}</span>
            <Button
              variant="outline"
              size="standard"
              onClick={() => fetchNotesList()}
              className="gap-1.5 w-fit"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Coba Lagi</span>
            </Button>
          </AlertDescription>
        </Alert>
      ) : notes.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {hasFilter ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan belajar'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {hasFilter
              ? 'Coba sesuaikan kata kunci pencarian atau filter mata kuliah yang dipilih.'
              : 'Mulai buat catatan materi kuliah untuk membantu persiapan ujian, rangkuman bab, dan pengulangan belajar.'}
          </p>
          {hasFilter ? (
            <Button
              variant="outline"
              size="standard"
              onClick={handleResetFilter}
              className="mt-4"
            >
              Hapus filter
            </Button>
          ) : (
            <Button
              size="standard"
              onClick={() => setIsCreateOpen(true)}
              disabled={activeCourses.length === 0}
              className="mt-4 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Buat catatan pertama</span>
            </Button>
          )}
        </div>
      ) : (
        /* Data Loaded View: Desktop Table + Mobile List */
        <div className="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3.5">
                      Judul Catatan
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Mata Kuliah
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Tautan Materi
                    </th>
                    <th scope="col" className="px-4 py-3.5">
                      Terakhir Diperbarui
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right w-14">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {notes.map((note) => {
                    const isArchived = Boolean(
                      note.course?.archivedAt || note.course?.semester?.archivedAt
                    );

                    return (
                      <tr
                        key={note.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Judul Catatan */}
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-col min-w-0 max-w-[360px]">
                            <Link
                              href={`/notes/${note.id}`}
                              className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-2 break-words"
                            >
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <span className="break-words">{note.title}</span>
                              {note.isPinned && (
                                <span title="Disematkan" aria-label="Disematkan" className="inline-flex text-primary shrink-0">
                                  <Pin className="h-3.5 w-3.5 fill-current" />
                                </span>
                              )}
                            </Link>
                          </div>
                        </td>

                        {/* Mata Kuliah */}
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                          {note.course ? (
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/courses/${note.course.id}`}
                                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1.5"
                                title={note.course.name}
                              >
                                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate max-w-[200px]">
                                  {note.course.name}
                                </span>
                              </Link>
                              {isArchived && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 px-1 border-muted"
                                >
                                  Arsip
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Mata Kuliah</span>
                          )}
                        </td>

                        {/* Tautan Materi */}
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                          {note.material ? (
                            <Link
                              href={`/materials/${note.material.id}`}
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline max-w-[220px] truncate"
                              title={note.material.title}
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{note.material.title}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              — Tidak terhubung —
                            </span>
                          )}
                        </td>

                        {/* Waktu Update */}
                        <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                          <span className="text-xs text-foreground font-medium">
                            {formatUserDateTime(note.updatedAt, timezone)}
                          </span>
                        </td>

                        {/* Aksi Dropdown */}
                        <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground"
                                aria-label={`Menu aksi untuk catatan "${note.title}"`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/notes/${note.id}`} className="flex items-center">
                                  <Pencil className="h-4 w-4 mr-2" />
                                  <span>Buka editor</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTogglePin(note)}
                                disabled={pinningId === note.id}
                                className="cursor-pointer text-xs"
                              >
                                {pinningId === note.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Pin className={`mr-2 h-4 w-4 ${note.isPinned ? 'fill-primary text-primary' : ''}`} />
                                )}
                                <span>{note.isPinned ? 'Lepas sematan' : 'Sematkan'}</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingNote(note)}
                                disabled={isArchived}
                                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                <span>Hapus catatan</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile List View (< 768px): Flat Clean List without Nested Cards */}
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden divide-y divide-border md:hidden">
            {notes.map((note) => {
              const isArchived = Boolean(
                note.course?.archivedAt || note.course?.semester?.archivedAt
              );

              return (
                <div key={note.id} className="p-3.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/notes/${note.id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors break-words flex-1 min-w-0 flex items-start gap-1.5"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="break-words">{note.title}</span>
                      {note.isPinned && (
                        <span title="Disematkan" aria-label="Disematkan" className="inline-flex text-primary shrink-0 mt-0.5">
                          <Pin className="h-3 w-3 fill-current" />
                        </span>
                      )}
                    </Link>
                    {isArchived && (
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 border-muted"
                      >
                        Arsip
                      </Badge>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {note.course && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{note.course.name}</span>
                      </span>
                    )}

                    {note.material && (
                      <span className="flex items-center gap-1 text-primary">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{note.material.title}</span>
                      </span>
                    )}
                  </div>

                  {/* Footer Row */}
                  <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatUserDateTime(note.updatedAt, timezone)}</span>
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground shrink-0"
                          aria-label={`Menu aksi untuk catatan "${note.title}"`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={`/notes/${note.id}`} className="flex items-center">
                            <Pencil className="h-4 w-4 mr-2" />
                            <span>Buka editor</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleTogglePin(note)}
                          disabled={pinningId === note.id}
                          className="cursor-pointer text-xs"
                        >
                          {pinningId === note.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Pin className={`mr-2 h-4 w-4 ${note.isPinned ? 'fill-primary text-primary' : ''}`} />
                          )}
                          <span>{note.isPinned ? 'Lepas sematan' : 'Sematkan'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingNote(note)}
                          disabled={isArchived}
                          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          <span>Hapus catatan</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog Create Note */}
      <CreateNoteDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        courses={courses}
        onSuccess={handleNoteCreated}
      />

      {/* Dialog Delete Note */}
      <DeleteNoteDialog
        open={Boolean(deletingNote)}
        onOpenChange={(open) => !open && setDeletingNote(null)}
        note={deletingNote}
        onSuccess={() => {
          setDeletingNote(null);
          fetchNotesList(true);
        }}
      />
    </div>
  );
}
