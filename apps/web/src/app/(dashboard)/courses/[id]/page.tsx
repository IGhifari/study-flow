'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarRange,
  User,
  Clock,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { Course, UpdateCourseInput } from '@studyflow/shared';
import {
  getCourse,
  updateCourse,
  archiveCourse,
  unarchiveCourse,
  deleteCourse,
} from '@/lib/course-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

export default function CourseDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = React.useState<Course | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modal Edit
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [editLecturer, setEditLecturer] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Modal Delete
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  const fetchDetail = React.useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getCourse(courseId);
      setCourse(data);
      setEditName(data.name);
      setEditCode(data.code || '');
      setEditLecturer(data.lecturer || '');
      setEditDescription(data.description || '');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat mata kuliah');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editName.trim()) {
      setEditError('Nama mata kuliah wajib diisi');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const input: UpdateCourseInput = {
        name: editName.trim(),
        code: editCode.trim() || null,
        lecturer: editLecturer.trim() || null,
        description: editDescription.trim() || null,
      };
      const updated = await updateCourse(courseId, input);
      setCourse(updated);
      setIsEditOpen(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal memperbarui mata kuliah');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleArchive = async () => {
    try {
      const updated = await archiveCourse(courseId);
      setCourse(updated);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengarsipkan mata kuliah');
    }
  };

  const handleUnarchive = async () => {
    try {
      const updated = await unarchiveCourse(courseId);
      setCourse(updated);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memulihkan mata kuliah');
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setIsSubmittingDelete(true);
    try {
      await deleteCourse(courseId);
      router.push('/courses');
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus mata kuliah');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mt-3 text-sm">Memuat detail mata kuliah...</p>
      </div>
    );
  }

  if (errorMsg || !course) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="gap-2 text-sm">
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Mata Kuliah</span>
          </Link>
        </Button>
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-danger" />
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {errorMsg || 'Mata kuliah tidak ditemukan'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mata kuliah mungkin telah dihapus atau Anda tidak memiliki akses ke halaman ini.
            </p>
            <Button asChild className="mt-4">
              <Link href="/courses">Lihat Semua Mata Kuliah</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isArchived = Boolean(course.archivedAt);

  return (
    <div className="space-y-6">
      {/* Top Back Nav & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" asChild className="gap-2 text-sm w-fit">
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Mata Kuliah</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>

          {isArchived ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnarchive}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Pulihkan</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="gap-1.5 text-muted-foreground"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Arsipkan</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            className="gap-1.5 text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus</span>
          </Button>
        </div>
      </div>

      {/* Main Course Info Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {course.name}
                </CardTitle>
                {course.code && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {course.code}
                  </Badge>
                )}
                {isArchived && (
                  <Badge variant="secondary" className="text-xs text-muted-foreground">
                    Arsip
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1 text-sm">
                Informasi dan detail mata kuliah
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Metadata Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Semester</p>
                <p className="font-medium text-sm text-foreground truncate">
                  {course.semester ? course.semester.name : 'Tidak terhubung'}
                  {course.semester?.isActive && ' (Aktif)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Dosen Pengampu</p>
                <p className="font-medium text-sm text-foreground truncate">
                  {course.lecturer || 'Belum ditentukan'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Tahun Ajaran</p>
                <p className="font-medium text-sm text-foreground truncate">
                  {course.semester ? course.semester.academicYear : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">Deskripsi / Catatan</h3>
            {course.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground">
                Belum ada deskripsi yang ditambahkan untuk mata kuliah ini.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Materials & Activity Placeholder per PRD scope boundaries */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            Materi & Aktivitas Perkuliahan
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Pengunggahan materi dokumen PDF, ringkasan materi AI, tugas, flashcard, dan kuis perkuliahan akan tersedia pada tahap berikutnya.
          </p>
        </CardContent>
      </Card>

      {/* Modal Edit Detail */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Mata Kuliah</DialogTitle>
              <DialogDescription>
                Perbarui detail informasi mata kuliah ini.
              </DialogDescription>
            </DialogHeader>

            {editError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <span>{editError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="detail-edit-name">Nama Mata Kuliah</Label>
                <Input
                  id="detail-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSubmittingEdit}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-edit-code">Kode Mata Kuliah</Label>
                  <Input
                    id="detail-edit-code"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    disabled={isSubmittingEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-edit-lecturer">Dosen Pengampu</Label>
                  <Input
                    id="detail-edit-lecturer"
                    value={editLecturer}
                    onChange={(e) => setEditLecturer(e.target.value)}
                    disabled={isSubmittingEdit}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="detail-edit-desc">Deskripsi</Label>
                <Textarea
                  id="detail-edit-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSubmittingEdit}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmittingEdit}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memperbarui...
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Hapus */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Mata Kuliah</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus mata kuliah{' '}
              <strong className="text-foreground">{course.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            Aksi ini akan menghapus data mata kuliah secara permanen dari akun Anda.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isSubmittingDelete}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmittingDelete}
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus Mata Kuliah'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
