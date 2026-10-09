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
} from 'lucide-react';
import {
  Course,
  Semester,
  CreateCourseInput,
  UpdateCourseInput,
} from '@studyflow/shared';
import {
  listCourses,
  createCourse,
  updateCourse,
  archiveCourse,
  unarchiveCourse,
  deleteCourse,
} from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  RadixSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  NativeSelect,
} from '@/components/ui/select';
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

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createSemesterId, setCreateSemesterId] = React.useState('');
  const [createName, setCreateName] = React.useState('');
  const [createCode, setCreateCode] = React.useState('');
  const [createLecturer, setCreateLecturer] = React.useState('');
  const [createDescription, setCreateDescription] = React.useState('');
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = React.useState(false);

  // Modal Edit
  const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [editLecturer, setEditLecturer] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Modal Delete
  const [deletingCourse, setDeletingCourse] = React.useState<Course | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  // Load Semesters first
  React.useEffect(() => {
    async function loadSemesters() {
      try {
        const semData = await listSemesters('all');
        setSemesters(semData.semesters);
        setActiveSemester(semData.activeSemester);
        if (semData.activeSemester) {
          setCreateSemesterId(semData.activeSemester.id);
        } else if (semData.semesters.length > 0) {
          const firstNonArchived = semData.semesters.find((s) => !s.archivedAt);
          if (firstNonArchived) setCreateSemesterId(firstNonArchived.id);
        }
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
      window.removeEventListener('studyflow:semester-changed', handleSemesterChange);
    };
  }, []);

  const fetchCourses = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await listCourses({
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
        isArchived: isArchivedFilter,
        search: searchQuery.trim() || undefined,
      });
      setCourses(data.courses);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat mata kuliah');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSemesterId, isArchivedFilter, searchQuery]);

  React.useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createSemesterId) {
      setCreateError('Silakan pilih semester untuk mata kuliah ini');
      return;
    }
    if (!createName.trim()) {
      setCreateError('Nama mata kuliah wajib diisi');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const input: CreateCourseInput = {
        semesterId: createSemesterId,
        name: createName.trim(),
        code: createCode.trim() || null,
        lecturer: createLecturer.trim() || null,
        description: createDescription.trim() || null,
      };
      await createCourse(input);
      setIsCreateOpen(false);
      setCreateName('');
      setCreateCode('');
      setCreateLecturer('');
      setCreateDescription('');
      await fetchCourses();
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal menambahkan mata kuliah');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleOpenEdit = (course: Course) => {
    setEditingCourse(course);
    setEditName(course.name);
    setEditCode(course.code || '');
    setEditLecturer(course.lecturer || '');
    setEditDescription(course.description || '');
    setEditError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
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
      await updateCourse(editingCourse.id, input);
      setEditingCourse(null);
      await fetchCourses();
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal memperbarui mata kuliah');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleArchive = async (id: string) => {
    setErrorMsg(null);
    try {
      await archiveCourse(id);
      await fetchCourses();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengarsipkan mata kuliah');
    }
  };

  const handleUnarchive = async (id: string) => {
    setErrorMsg(null);
    try {
      await unarchiveCourse(id);
      await fetchCourses();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memulihkan mata kuliah');
    }
  };

  const handleDelete = async () => {
    if (!deletingCourse) return;
    setDeleteError(null);
    setIsSubmittingDelete(true);
    try {
      await deleteCourse(deletingCourse.id);
      setDeletingCourse(null);
      await fetchCourses();
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus mata kuliah');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Filter out archived semesters for new courses
  const nonArchivedSemesters = semesters.filter((s) => !s.archivedAt);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Mata Kuliah
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola daftar mata kuliah perkuliahan Anda per semester.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setIsCreateOpen(true);
          }}
          disabled={nonArchivedSemesters.length === 0}
          className="inline-flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Mata Kuliah</span>
        </Button>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Semester Selector */}
          <div className="w-56 sm:w-64">
            <RadixSelect
              value={selectedSemesterId}
              onValueChange={(val) => setSelectedSemesterId(val)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Semua Semester" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[300px]">
                <SelectItem value="all">Semua Semester</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '(Aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>
          </div>

          {/* Archive Status Toggle */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            <button
              type="button"
              onClick={() => setIsArchivedFilter(false)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                !isArchivedFilter
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setIsArchivedFilter(true)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                isArchivedFilter
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Arsip
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari mata kuliah atau kode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content List / States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Memuat data mata kuliah...</p>
        </div>
      ) : semesters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarRange className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              Belum ada semester dibuat
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Mata kuliah membutuhkan semester untuk pengelompokan. Buat semester pertama Anda sebelum menambahkan mata kuliah.
            </p>
            <Button
              asChild
              className="mt-4 inline-flex items-center gap-2"
            >
              <Link href="/semesters">
                <span>Kelola Semester</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : courses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {searchQuery
                ? 'Tidak ada mata kuliah yang cocok'
                : isArchivedFilter
                ? 'Tidak ada mata kuliah diarsipkan'
                : 'Belum ada mata kuliah'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {searchQuery
                ? `Tidak ditemukan mata kuliah dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                : isArchivedFilter
                ? 'Mata kuliah yang Anda arsipkan akan muncul di sini.'
                : 'Mulai tambahkan mata kuliah Anda untuk semester ini.'}
            </p>
            {!searchQuery && !isArchivedFilter && nonArchivedSemesters.length > 0 && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                variant="outline"
                className="mt-4 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Mata Kuliah Pertama</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const isArchived = Boolean(course.archivedAt);
            return (
              <Card
                key={course.id}
                className="relative flex flex-col justify-between transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/courses/${course.id}`}
                        className="group flex items-center gap-1.5"
                      >
                        <CardTitle className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {course.name}
                        </CardTitle>
                      </Link>
                      {course.code && (
                        <div className="mt-1">
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {course.code}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {isArchived && (
                      <Badge variant="secondary" className="shrink-0 text-muted-foreground">
                        Arsip
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {course.lecturer && (
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{course.lecturer}</span>
                      </div>
                    )}
                    {course.semester && (
                      <div className="flex items-center gap-1.5 truncate">
                        <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {course.semester.name} {course.semester.isActive ? '(Aktif)' : ''}
                        </span>
                      </div>
                    )}
                    {course.description && (
                      <p className="line-clamp-2 text-foreground/80 mt-1 text-xs">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="text-xs"
                    >
                      <Link href={`/courses/${course.id}`}>
                        Buka Detail
                      </Link>
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(course)}
                        className="h-8 w-8 p-0"
                        title="Edit mata kuliah"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit mata kuliah</span>
                      </Button>

                      {isArchived ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUnarchive(course.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Pulihkan mata kuliah"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span className="sr-only">Pulihkan</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(course.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Arsipkan mata kuliah"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span className="sr-only">Arsipkan</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingCourse(course);
                        }}
                        className="h-8 w-8 p-0 text-danger hover:bg-danger/10"
                        title="Hapus mata kuliah"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Hapus</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Tambah Mata Kuliah */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Tambah Mata Kuliah</DialogTitle>
              <DialogDescription>
                Lengkapi informasi mata kuliah yang ingin Anda daftarkan.
              </DialogDescription>
            </DialogHeader>

            {createError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <span>{createError}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-course-sem">Semester</Label>
                <NativeSelect
                  id="create-course-sem"
                  value={createSemesterId}
                  onChange={(e) => setCreateSemesterId(e.target.value)}
                  disabled={isSubmittingCreate}
                >
                  <option value="">Pilih Semester</option>
                  {nonArchivedSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.academicYear}) {s.isActive ? '— Aktif' : ''}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-course-name">Nama Mata Kuliah</Label>
                <Input
                  id="create-course-name"
                  placeholder="Contoh: Algoritma & Pemrograman"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  disabled={isSubmittingCreate}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-course-code">Kode (Opsional)</Label>
                  <Input
                    id="create-course-code"
                    placeholder="Contoh: IF210"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value)}
                    disabled={isSubmittingCreate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="create-course-lecturer">Dosen (Opsional)</Label>
                  <Input
                    id="create-course-lecturer"
                    placeholder="Contoh: Dr. Budi"
                    value={createLecturer}
                    onChange={(e) => setCreateLecturer(e.target.value)}
                    disabled={isSubmittingCreate}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-course-desc">Deskripsi (Opsional)</Label>
                <Textarea
                  id="create-course-desc"
                  placeholder="Catatan mengenai silabus, ruang kelas, atau jadwal..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  disabled={isSubmittingCreate}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
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
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Mata Kuliah'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Mata Kuliah */}
      <Dialog
        open={Boolean(editingCourse)}
        onOpenChange={(open) => !open && setEditingCourse(null)}
      >
        <DialogContent>
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Edit Mata Kuliah</DialogTitle>
              <DialogDescription>
                Perbarui detail mata kuliah {editingCourse?.name}.
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
                <Label htmlFor="edit-course-name">Nama Mata Kuliah</Label>
                <Input
                  id="edit-course-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSubmittingEdit}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-course-code">Kode Mata Kuliah</Label>
                  <Input
                    id="edit-course-code"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    disabled={isSubmittingEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-course-lecturer">Dosen Pengampu</Label>
                  <Input
                    id="edit-course-lecturer"
                    value={editLecturer}
                    onChange={(e) => setEditLecturer(e.target.value)}
                    disabled={isSubmittingEdit}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-course-desc">Deskripsi</Label>
                <Textarea
                  id="edit-course-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isSubmittingEdit}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCourse(null)}
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

      {/* Modal Hapus Mata Kuliah */}
      <Dialog
        open={Boolean(deletingCourse)}
        onOpenChange={(open) => !open && setDeletingCourse(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Mata Kuliah</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus mata kuliah{' '}
              <strong className="text-foreground">{deletingCourse?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            Aksi ini bersifat permanen. Jika Anda hanya ingin menyembunyikannya dari daftar aktif, gunakan fitur arsip.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingCourse(null)}
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
