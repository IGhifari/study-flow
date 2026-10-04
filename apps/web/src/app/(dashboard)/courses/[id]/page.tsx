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
  AlertTriangle,
  Loader2,
  BookOpen,
  ListTodo,
  FileText,
  Plus,
  CheckCircle2,
  Circle,
  ExternalLink,
} from 'lucide-react';
import {
  Course,
  UpdateCourseInput,
  Assignment,
  NoteListItem,
  formatUserDateTime,
  toUserDateTimeInputValue,
  UserProfile,
} from '@studyflow/shared';
import {
  getCourse,
  updateCourse,
  archiveCourse,
  unarchiveCourse,
  deleteCourse,
} from '@/lib/course-client';
import {
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/lib/assignment-client';
import {
  listNotes,
  createNote,
  deleteNote,
} from '@/lib/note-client';
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

export default function CourseDetailPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = React.useState<Course | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Tabs: 'assignments' | 'notes'
  const [activeTab, setActiveTab] = React.useState<'assignments' | 'notes'>('assignments');

  // Course Assignments state
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = React.useState(false);

  // Course Notes state
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [isNotesLoading, setIsNotesLoading] = React.useState(false);

  // Modal Edit Course
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [editLecturer, setEditLecturer] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Modal Delete Course
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  // Modal Create Assignment for this Course
  const [isCreateAsgOpen, setIsCreateAsgOpen] = React.useState(false);
  const [createAsgTitle, setCreateAsgTitle] = React.useState('');
  const [createAsgDesc, setCreateAsgDesc] = React.useState('');
  const [createAsgDueDate, setCreateAsgDueDate] = React.useState('');
  const [createAsgPriority, setCreateAsgPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [createAsgError, setCreateAsgError] = React.useState<string | null>(null);
  const [isSubmittingAsg, setIsSubmittingAsg] = React.useState(false);

  // Modal Create Note for this Course
  const [isCreateNoteOpen, setIsCreateNoteOpen] = React.useState(false);
  const [createNoteTitle, setCreateNoteTitle] = React.useState('');
  const [createNoteContent, setCreateNoteContent] = React.useState('');
  const [createNoteError, setCreateNoteError] = React.useState<string | null>(null);
  const [isSubmittingNote, setIsSubmittingNote] = React.useState(false);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  const fetchCourseData = React.useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profile, courseData] = await Promise.all([
        getProfile().catch(() => null),
        getCourse(courseId),
      ]);
      if (profile) setUserProfile(profile);
      setCourse(courseData);
      setEditName(courseData.name);
      setEditCode(courseData.code || '');
      setEditLecturer(courseData.lecturer || '');
      setEditDescription(courseData.description || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat mata kuliah');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  const fetchAssignmentsData = React.useCallback(async () => {
    if (!courseId) return;
    setIsAssignmentsLoading(true);
    try {
      const res = await listAssignments({ courseId, limit: 100 });
      setAssignments(res.assignments);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setIsAssignmentsLoading(false);
    }
  }, [courseId]);

  const fetchNotesData = React.useCallback(async () => {
    if (!courseId) return;
    setIsNotesLoading(true);
    try {
      const res = await listNotes({ courseId, limit: 100 });
      setNotes(res.notes);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setIsNotesLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchCourseData();
    fetchAssignmentsData();
    fetchNotesData();
  }, [fetchCourseData, fetchAssignmentsData, fetchNotesData]);

  const isArchived = Boolean(course?.archivedAt || course?.semester?.archivedAt);

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
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui mata kuliah');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleArchive = async () => {
    try {
      const updated = await archiveCourse(courseId);
      setCourse(updated);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengarsipkan mata kuliah');
    }
  };

  const handleUnarchive = async () => {
    try {
      const updated = await unarchiveCourse(courseId);
      setCourse(updated);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memulihkan mata kuliah');
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setIsSubmittingDelete(true);
    try {
      await deleteCourse(courseId);
      router.push('/courses');
      router.refresh();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus mata kuliah');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Create Assignment directly for this course
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createAsgTitle.trim()) {
      setCreateAsgError('Judul tugas wajib diisi');
      return;
    }
    if (!createAsgDueDate) {
      setCreateAsgError('Tenggat waktu wajib diisi');
      return;
    }

    setIsSubmittingAsg(true);
    setCreateAsgError(null);
    try {
      await createAssignment({
        courseId,
        title: createAsgTitle.trim(),
        description: createAsgDesc.trim() || undefined,
        dueDate: createAsgDueDate,
        priority: createAsgPriority,
        status: 'TODO',
      });
      setIsCreateAsgOpen(false);
      setCreateAsgTitle('');
      setCreateAsgDesc('');
      setCreateAsgDueDate('');
      fetchAssignmentsData();
    } catch (err: any) {
      setCreateAsgError(err.message || 'Gagal menambahkan tugas baru');
    } finally {
      setIsSubmittingAsg(false);
    }
  };

  // Toggle Assignment Status
  const handleToggleAssignmentStatus = async (asg: Assignment) => {
    const nextStatus = asg.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await updateAssignment(asg.id, { status: nextStatus });
      fetchAssignmentsData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status tugas');
    }
  };

  // Create Note directly for this course
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createNoteTitle.trim()) {
      setCreateNoteError('Judul catatan wajib diisi');
      return;
    }

    setIsSubmittingNote(true);
    setCreateNoteError(null);
    try {
      const created = await createNote({
        courseId,
        title: createNoteTitle.trim(),
        content: createNoteContent.trim() || '',
      });
      setIsCreateNoteOpen(false);
      router.push(`/notes/${created.id}`);
    } catch (err: any) {
      setCreateNoteError(err.message || 'Gagal membuat catatan');
      setIsSubmittingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            disabled={isArchived}
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

      {/* Archived Banner */}
      {isArchived && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-xs text-warning-foreground flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="font-semibold text-sm">Mata Kuliah / Semester Diarsipkan (Hanya-Baca)</p>
            <p className="mt-0.5 text-muted-foreground">
              Konten tugas dan catatan pada mata kuliah ini bersifat hanya-baca. Pulihkan mata kuliah dan semester untuk menambahkan atau mengedit konten.
            </p>
          </div>
        </div>
      )}

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
          {course.description && (
            <div>
              <h3 className="text-sm font-semibold text-foreground">Deskripsi / Silabus</h3>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs Navigation: Tugas & Catatan */}
      <div className="space-y-4">
        <div className="flex border-b border-border gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'assignments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListTodo className="h-4 w-4" />
            <span>Tugas ({assignments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'notes'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Catatan ({notes.length})</span>
          </button>
        </div>

        {/* Tab 1: Tugas */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Daftar Tugas Mata Kuliah</h3>
              <Button
                size="sm"
                onClick={() => {
                  setCreateAsgTitle('');
                  setCreateAsgDesc('');
                  setCreateAsgDueDate('');
                  setCreateAsgPriority('MEDIUM');
                  setCreateAsgError(null);
                  setIsCreateAsgOpen(true);
                }}
                disabled={isArchived}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Tambah Tugas
              </Button>
            </div>

            {isAssignmentsLoading ? (
              <div className="flex py-12 justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : assignments.length === 0 ? (
              <Card className="border-dashed p-8 text-center bg-card/40">
                <ListTodo className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="mt-2 text-sm font-semibold text-foreground">Belum ada tugas pada mata kuliah ini</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tambahkan tugas untuk mencatat deadline praktikum, proyek, atau ujian.
                </p>
                {!isArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCreateAsgOpen(true)}
                    className="mt-4"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Tambah Tugas
                  </Button>
                )}
              </Card>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 w-12 text-center">Status</th>
                      <th scope="col" className="px-4 py-3">Judul Tugas</th>
                      <th scope="col" className="px-4 py-3">Tenggat Waktu</th>
                      <th scope="col" className="px-4 py-3">Prioritas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assignments.map((asg) => {
                      const isDone = asg.status === 'DONE';
                      return (
                        <tr key={asg.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAssignmentStatus(asg)}
                              disabled={isArchived}
                              className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                              title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <Circle className="h-5 w-5 hover:text-primary" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {asg.title}
                            </span>
                            {asg.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{asg.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                            {formatUserDateTime(asg.dueDate, timezone)}
                            {asg.isOverdue && !isDone && (
                              <span className="block text-danger font-semibold mt-0.5">Terlambat</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              variant={asg.priority === 'HIGH' ? 'danger' : asg.priority === 'MEDIUM' ? 'default' : 'secondary'}
                              className="text-[11px]"
                            >
                              {asg.priority}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Catatan */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Daftar Catatan Mata Kuliah</h3>
              <Button
                size="sm"
                onClick={() => {
                  setCreateNoteTitle('');
                  setCreateNoteContent('');
                  setCreateNoteError(null);
                  setIsCreateNoteOpen(true);
                }}
                disabled={isArchived}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Buat Catatan
              </Button>
            </div>

            {isNotesLoading ? (
              <div className="flex py-12 justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : notes.length === 0 ? (
              <Card className="border-dashed p-8 text-center bg-card/40">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="mt-2 text-sm font-semibold text-foreground">Belum ada catatan untuk mata kuliah ini</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tulis rangkuman materi perkuliahan untuk mempermudah belajar.
                </p>
                {!isArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCreateNoteOpen(true)}
                    className="mt-4"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Buat Catatan
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {notes.map((n) => (
                  <Card key={n.id} className="p-4 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-xs">
                    <div>
                      <Link
                        href={`/notes/${n.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 text-sm"
                      >
                        {n.title}
                      </Link>
                      <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Diperbarui: {formatUserDateTime(n.updatedAt, timezone)}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-end border-t border-border pt-2">
                      <Link href={`/notes/${n.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          Buka Editor
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
            Mata kuliah yang memiliki tugas atau catatan tidak dapat dihapus. Silakan arsipkan jika mata kuliah sudah selesai.
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

      {/* Modal Create Assignment on Course */}
      <Dialog open={isCreateAsgOpen} onOpenChange={setIsCreateAsgOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambah Tugas untuk {course.name}</DialogTitle>
            <DialogDescription>
              Catat tugas baru untuk mata kuliah ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssignment} className="space-y-4 py-2">
            {createAsgError && (
              <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20">
                {createAsgError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-title">Judul Tugas *</Label>
              <Input
                id="course-asg-title"
                value={createAsgTitle}
                onChange={(e) => setCreateAsgTitle(e.target.value)}
                placeholder="Contoh: Laporan Akhir"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-due">Tenggat Waktu *</Label>
              <Input
                id="course-asg-due"
                type="datetime-local"
                value={createAsgDueDate}
                onChange={(e) => setCreateAsgDueDate(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Zona waktu: {timezone}.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-priority">Prioritas</Label>
              <Select
                id="course-asg-priority"
                value={createAsgPriority}
                onChange={(e) => setCreateAsgPriority(e.target.value as any)}
              >
                <option value="LOW">Rendah (Low)</option>
                <option value="MEDIUM">Sedang (Medium)</option>
                <option value="HIGH">Tinggi (High)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-desc">Deskripsi (Opsional)</Label>
              <Textarea
                id="course-asg-desc"
                value={createAsgDesc}
                onChange={(e) => setCreateAsgDesc(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateAsgOpen(false)}
                disabled={isSubmittingAsg}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingAsg}>
                {isSubmittingAsg ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Tugas'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Create Note on Course */}
      <Dialog open={isCreateNoteOpen} onOpenChange={setIsCreateNoteOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Buat Catatan untuk {course.name}</DialogTitle>
            <DialogDescription>
              Tulis catatan baru untuk mata kuliah ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateNote} className="space-y-4 py-2">
            {createNoteError && (
              <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20">
                {createNoteError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="course-note-title">Judul Catatan *</Label>
              <Input
                id="course-note-title"
                value={createNoteTitle}
                onChange={(e) => setCreateNoteTitle(e.target.value)}
                placeholder="Contoh: Ringkasan Kuliah Minggu Ke-4"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-note-desc">Isi Awal (Opsional - Markdown)</Label>
              <Textarea
                id="course-note-desc"
                value={createNoteContent}
                onChange={(e) => setCreateNoteContent(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateNoteOpen(false)}
                disabled={isSubmittingNote}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmittingNote}>
                {isSubmittingNote ? (
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
    </div>
  );
}
