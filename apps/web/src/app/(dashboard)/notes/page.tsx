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
  ExternalLink,
} from 'lucide-react';
import {
  NoteListItem,
  Course,
  UserProfile,
  formatUserDateTime,
  Note,
} from '@studyflow/shared';
import { listNotes } from '@/lib/note-client';
import { listCourses } from '@/lib/course-client';
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
import { CreateNoteDialog } from '@/components/notes/create-note-dialog';
import { DeleteNoteDialog } from '@/components/notes/delete-note-dialog';

export default function NotesPage(): React.JSX.Element {
  const router = useRouter();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
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

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Race condition protection
  const fetchRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [profile, courseRes] = await Promise.all([
          getProfile().catch(() => null),
          listCourses().catch(() => ({ courses: [] })),
        ]);
        if (!isMounted) return;
        if (profile) setUserProfile(profile);
        setCourses(courseRes.courses);
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

  const activeCourses = React.useMemo(
    () => courses.filter((c) => !c.archivedAt),
    [courses]
  );

  const hasFilter = Boolean(searchQuery || selectedCourseId !== 'ALL');

  const handleResetFilter = () => {
    setSearchQuery('');
    setSelectedCourseId('ALL');
  };

  const handleNoteCreated = (created: Note) => {
    router.push(`/notes/${created.id}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
            Catatan Belajar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tulis dan baca ringkasan materi kuliah menggunakan format Markdown yang rapi dan aman.
          </p>
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

      {/* 2. Pencarian dan Filter Toolbar */}
      <Card className="border border-border shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="w-full sm:w-[240px]">
                <Select
                  value={selectedCourseId}
                  onValueChange={(val) => setSelectedCourseId(val)}
                >
                  <SelectTrigger className="h-9 text-sm">
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

              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilter}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 self-start sm:self-auto"
                >
                  Hapus filter
                </Button>
              )}
            </div>
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
              size="sm"
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
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 sm:p-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <FileText className="h-6 w-6" />
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
              className="mt-5"
            >
              Hapus filter
            </Button>
          ) : (
            <Button
              size="standard"
              onClick={() => setIsCreateOpen(true)}
              disabled={activeCourses.length === 0}
              className="mt-5 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Buat catatan pertama</span>
            </Button>
          )}
        </div>
      ) : (
        /* Data Loaded View: Desktop Table + Mobile Cards */
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
                    <th scope="col" className="px-4 py-3.5 text-right">
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
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <Link
                              href={`/notes/${note.id}`}
                              className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                            >
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <span className="truncate max-w-[280px]">{note.title}</span>
                            </Link>
                          </div>
                        </td>

                        {/* Mata Kuliah */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
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
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {note.material ? (
                            <Link
                              href={`/materials/${note.material.id}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[200px] truncate"
                              title={note.material.title}
                            >
                              <span>📄</span>
                              <span className="truncate">{note.material.title}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              — Tidak terhubung —
                            </span>
                          )}
                        </td>

                        {/* Waktu Update */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs text-foreground font-medium">
                            {formatUserDateTime(note.updatedAt, timezone)}
                          </span>
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Buka dan edit catatan"
                              aria-label={`Buka catatan "${note.title}"`}
                            >
                              <Link href={`/notes/${note.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingNote(note)}
                              disabled={isArchived}
                              title={
                                isArchived
                                  ? 'Mata kuliah diarsipkan (hanya-baca)'
                                  : 'Hapus catatan'
                              }
                              aria-label={`Hapus catatan "${note.title}"`}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-danger hover:bg-danger/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {notes.map((note) => {
              const isArchived = Boolean(
                note.course?.archivedAt || note.course?.semester?.archivedAt
              );

              return (
                <Card key={note.id} className="p-4 shadow-xs">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/notes/${note.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2"
                      >
                        {note.title}
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

                    {note.course && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span className="truncate">{note.course.name}</span>
                      </p>
                    )}

                    {note.material && (
                      <div className="text-xs">
                        <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium truncate inline-block max-w-[240px]">
                          📄 {note.material.title}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatUserDateTime(note.updatedAt, timezone)}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          aria-label={`Buka catatan "${note.title}"`}
                        >
                          <Link href={`/notes/${note.id}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Buka
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingNote(note)}
                          disabled={isArchived}
                          aria-label={`Hapus catatan "${note.title}"`}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
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
