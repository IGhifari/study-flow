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
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  NoteListItem,
  Course,
  Semester,
  UserProfile,
  formatUserDateTime,
} from '@studyflow/shared';
import {
  listNotes,
  createNote,
  deleteNote,
} from '@/lib/note-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function NotesPage(): React.JSX.Element {
  const router = useRouter();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  // Filters
  const [selectedSemesterId, setSelectedSemesterId] = React.useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createCourseId, setCreateCourseId] = React.useState('');
  const [createTitle, setCreateTitle] = React.useState('');
  const [createContent, setCreateContent] = React.useState('');
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = React.useState(false);

  // Modal Delete
  const [deletingNote, setDeletingNote] = React.useState<NoteListItem | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  React.useEffect(() => {
    async function loadMeta() {
      try {
        const [profile, semData, crsData] = await Promise.all([
          getProfile().catch(() => null),
          listSemesters('all').catch(() => ({ semesters: [] })),
          listCourses().catch(() => ({ courses: [] })),
        ]);
        if (profile) setUserProfile(profile);
        setSemesters(semData.semesters);
        setCourses(crsData.courses);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMeta();
  }, []);

  const fetchNotes = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await listNotes({
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
        courseId: selectedCourseId === 'all' ? undefined : selectedCourseId,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });
      setNotes(data.notes);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat catatan belajar.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSemesterId, selectedCourseId, searchQuery]);

  React.useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const activeCourses = courses.filter((c) => !c.archivedAt);

  const handleOpenCreate = () => {
    setCreateTitle('');
    setCreateContent('');
    setCreateError(null);
    setCreateCourseId(activeCourses.length > 0 ? activeCourses[0]!.id : '');
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError('Judul catatan wajib diisi');
      return;
    }
    if (!createCourseId) {
      setCreateError('Mata kuliah wajib dipilih');
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      const created = await createNote({
        courseId: createCourseId,
        title: createTitle.trim(),
        content: createContent.trim() || '',
      });
      setIsCreateOpen(false);
      router.push(`/notes/${created.id}`);
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat catatan baru.');
      setIsSubmittingCreate(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingNote) return;
    setIsSubmittingDelete(true);
    setDeleteError(null);
    try {
      await deleteNote(deletingNote.id);
      setDeletingNote(null);
      fetchNotes();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus catatan.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
          onClick={handleOpenCreate}
          disabled={activeCourses.length === 0}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Buat Catatan
        </Button>
      </div>

      {activeCourses.length === 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Belum ada mata kuliah aktif</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Anda perlu menambahkan mata kuliah aktif terlebih dahulu sebelum dapat membuat catatan belajar.
            </p>
            <Link href="/courses" className="mt-2 inline-block text-xs font-semibold text-primary underline">
              Kelola Mata Kuliah &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <Card className="p-4 bg-card/60 backdrop-blur-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari judul catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Semester */}
          <div>
            <Select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              aria-label="Filter Semester"
            >
              <option value="all">Semua Semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isActive ? '(Aktif)' : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Filter Course */}
          <div>
            <Select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              aria-label="Filter Mata Kuliah"
            >
              <option value="all">Semua Mata Kuliah</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''} {c.archivedAt ? '[Arsip]' : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Memuat catatan belajar...</p>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-danger" />
          <h3 className="mt-3 text-base font-semibold text-danger">Gagal Memuat Catatan</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">{errorMsg}</p>
          <Button variant="outline" onClick={() => fetchNotes()} className="mt-4">
            Coba Lagi
          </Button>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {searchQuery || selectedCourseId !== 'all' || selectedSemesterId !== 'all'
              ? 'Tidak ada catatan yang cocok'
              : 'Belum ada catatan belajar'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {searchQuery || selectedCourseId !== 'all' || selectedSemesterId !== 'all'
              ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
              : 'Mulai buat catatan materi kuliah untuk membantu persiapan ujian dan belajar.'}
          </p>
          {!(searchQuery || selectedCourseId !== 'all' || selectedSemesterId !== 'all') && (
            <Button onClick={handleOpenCreate} disabled={activeCourses.length === 0} className="mt-5">
              <Plus className="mr-2 h-4 w-4" />
              Buat Catatan Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => {
            const isArchived = Boolean(note.course?.archivedAt || note.course?.semester?.archivedAt);

            return (
              <Card
                key={note.id}
                className="group flex flex-col justify-between hover:border-primary/50 transition-all shadow-xs"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/notes/${note.id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 text-base"
                    >
                      {note.title}
                    </Link>
                    {isArchived && (
                      <Badge variant="outline" className="text-[10px] shrink-0 border-muted">
                        Arsip
                      </Badge>
                    )}
                  </div>
                  {note.course && (
                    <CardDescription className="flex items-center gap-1.5 mt-1 text-xs">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{note.course.name}</span>
                    </CardDescription>
                  )}
                  {note.material && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs">
                      <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium truncate max-w-[200px]" title={note.material.title}>
                        📄 {note.material.title}
                      </span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatUserDateTime(note.updatedAt, timezone)}
                    </span>

                    <div className="flex items-center gap-1">
                      <Link href={`/notes/${note.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Buka
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingNote(note)}
                        disabled={isArchived}
                        className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                        title={isArchived ? 'Arsip (hanya-baca)' : 'Hapus catatan'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Create Note */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Buat Catatan Baru</DialogTitle>
            <DialogDescription>
              Tulis judul dan pilih mata kuliah. Anda dapat langsung mengedit isinya di halaman editor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="create-note-title">Judul Catatan *</Label>
              <Input
                id="create-note-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Contoh: Rangkuman Bab 3 - Thread dan Concurrency"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-note-course">Mata Kuliah *</Label>
              <Select
                id="create-note-course"
                value={createCourseId}
                onChange={(e) => setCreateCourseId(e.target.value)}
                required
              >
                <option value="" disabled>Pilih mata kuliah aktif</option>
                {activeCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-note-content">Isi Awal (Opsional - Format Markdown)</Label>
              <Textarea
                id="create-note-content"
                value={createContent}
                onChange={(e) => setCreateContent(e.target.value)}
                placeholder="# Bab 3..."
                rows={4}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingCreate}>
                {isSubmittingCreate ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  'Buat & Buka Editor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirm Delete */}
      <Dialog open={Boolean(deletingNote)} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Hapus Catatan</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus catatan <strong className="text-foreground">{deletingNote?.title}</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20">
              {deleteError}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingNote(null)}
              disabled={isSubmittingDelete}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSubmit}
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus Catatan'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
