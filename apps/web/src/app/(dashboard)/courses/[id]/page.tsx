'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarRange,
  CalendarClock,
  User,
  Clock,
  MapPin,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ListTodo,
  FileText,
  Plus,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileUp,
} from 'lucide-react';
import {
  Course,
  Assignment,
  NoteListItem,
  MaterialListItem,
  formatFileSize,
  formatUserDateTime,
  UserProfile,
  CourseSchedule,
  CourseScheduleConflict,
  getDayNameId,
} from '@studyflow/shared';
import {
  getCourse,
  archiveCourse,
  unarchiveCourse,
} from '@/lib/course-client';
import {
  listAssignments,
  createAssignment,
  updateAssignment,
} from '@/lib/assignment-client';
import {
  listNotes,
  createNote,
} from '@/lib/note-client';
import { listMaterials } from '@/lib/material-client';
import { listSchedules } from '@/lib/schedule-client';
import { CreateScheduleDialog } from '@/components/schedules/create-schedule-dialog';
import { EditScheduleDialog } from '@/components/schedules/edit-schedule-dialog';
import { DeleteScheduleDialog } from '@/components/schedules/delete-schedule-dialog';
import { MaterialUploadDialog } from '@/components/materials/material-upload-dialog';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { getProfile } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  RadixSelect as Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  FadeIn,
  StaggerGroup,
  StaggerItem,
  AnimatedPanel,
} from '@/components/ui/motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EditCourseDialog } from '@/components/courses/edit-course-dialog';
import { DeleteCourseDialog } from '@/components/courses/delete-course-dialog';
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
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Tabs state
  const [activeTab, setActiveTab] = React.useState('assignments');

  // Course Assignments state
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = React.useState(false);
  const [pendingAssignmentIds, setPendingAssignmentIds] = React.useState<Set<string>>(new Set());

  // Course Notes state
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [isNotesLoading, setIsNotesLoading] = React.useState(false);

  // Course Materials state
  const [materials, setMaterials] = React.useState<MaterialListItem[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = React.useState(false);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  // Course Schedules state
  const [schedules, setSchedules] = React.useState<CourseSchedule[]>([]);
  const [isSchedulesLoading, setIsSchedulesLoading] = React.useState(false);
  const [scheduleConflictBanner, setScheduleConflictBanner] = React.useState<string | null>(null);
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<CourseSchedule | null>(null);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = React.useState(false);
  const [deletingSchedule, setDeletingSchedule] = React.useState<CourseSchedule | null>(null);
  const [isDeleteScheduleOpen, setIsDeleteScheduleOpen] = React.useState(false);

  // Dialogs
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

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

  const fetchMaterialsData = React.useCallback(async () => {
    if (!courseId) return;
    setIsMaterialsLoading(true);
    try {
      const res = await listMaterials({ courseId, limit: 100 });
      setMaterials(res.materials);
    } catch (err) {
      console.error('Failed to load materials:', err);
    } finally {
      setIsMaterialsLoading(false);
    }
  }, [courseId]);

  const fetchSchedulesData = React.useCallback(async () => {
    if (!courseId) return;
    setIsSchedulesLoading(true);
    try {
      const res = await listSchedules({ courseId });
      setSchedules(res.schedules);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setIsSchedulesLoading(false);
    }
  }, [courseId]);

  React.useEffect(() => {
    fetchCourseData();
    fetchAssignmentsData();
    fetchNotesData();
    fetchMaterialsData();
    fetchSchedulesData();
  }, [fetchCourseData, fetchAssignmentsData, fetchNotesData, fetchMaterialsData, fetchSchedulesData]);

  const handleScheduleCreated = (
    _newSched: CourseSchedule,
    hasConflict: boolean,
    conflicts?: CourseScheduleConflict[]
  ) => {
    if (hasConflict && conflicts && conflicts.length > 0) {
      const conflictNames = conflicts.map((c) => `${c.courseName} (${c.startTime}–${c.endTime})`).join(', ');
      setScheduleConflictBanner(
        `Jadwal disimpan, namun bertabrakan waktu dengan: ${conflictNames}`
      );
    } else {
      setScheduleConflictBanner(null);
    }
    fetchSchedulesData();
  };

  const handleScheduleUpdated = (
    _updatedSched: CourseSchedule,
    hasConflict: boolean,
    conflicts?: CourseScheduleConflict[]
  ) => {
    if (hasConflict && conflicts && conflicts.length > 0) {
      const conflictNames = conflicts.map((c) => `${c.courseName} (${c.startTime}–${c.endTime})`).join(', ');
      setScheduleConflictBanner(
        `Jadwal diperbarui, namun bertabrakan waktu dengan: ${conflictNames}`
      );
    } else {
      setScheduleConflictBanner(null);
    }
    fetchSchedulesData();
  };

  const handleScheduleDeleted = () => {
    setScheduleConflictBanner(null);
    fetchSchedulesData();
  };

  const isArchived = Boolean(course?.archivedAt || course?.semester?.archivedAt);

  const handleArchive = async () => {
    setActionError(null);
    try {
      const updated = await archiveCourse(courseId);
      setCourse(updated);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengarsipkan mata kuliah.');
    }
  };

  const handleUnarchive = async () => {
    setActionError(null);
    try {
      const updated = await unarchiveCourse(courseId);
      setCourse(updated);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || 'Gagal memulihkan mata kuliah.');
    }
  };

  // Toggle Assignment Status with optimistic update
  const handleToggleAssignmentStatus = async (asg: Assignment) => {
    if (pendingAssignmentIds.has(asg.id) || isArchived) return;

    const nextStatus = asg.status === 'DONE' ? 'TODO' : 'DONE';
    setPendingAssignmentIds((prev) => new Set(prev).add(asg.id));
    setAssignments((prev) =>
      prev.map((item) => (item.id === asg.id ? { ...item, status: nextStatus } : item))
    );

    try {
      await updateAssignment(asg.id, { status: nextStatus });
      await fetchAssignmentsData();
    } catch (err: any) {
      // Revert optimistic update
      setAssignments((prev) =>
        prev.map((item) => (item.id === asg.id ? asg : item))
      );
      setActionError(err.message || 'Gagal memperbarui status tugas.');
    } finally {
      setPendingAssignmentIds((prev) => {
        const next = new Set(prev);
        next.delete(asg.id);
        return next;
      });
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (errorMsg || !course) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild size="sm" className="h-8 gap-2 text-sm w-fit -ml-2">
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Mata Kuliah</span>
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Mata Kuliah Tidak Ditemukan</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{errorMsg || 'Mata kuliah tidak ditemukan atau Anda tidak memiliki akses ke halaman ini.'}</span>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/courses">Lihat Semua Mata Kuliah</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <FadeIn className="space-y-6">
      {/* 1. Top Navigasi & Aksi Utama */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <Button
          variant="ghost"
          asChild
          size="sm"
          className="h-8 gap-2 text-sm w-fit -ml-2 relative after:absolute after:-inset-1.5 sm:after:hidden touch-manipulation"
        >
          <Link href="/courses">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Mata Kuliah</span>
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            disabled={isArchived}
            className="h-8 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>

          {isArchived ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnarchive}
              className="h-8 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Pulihkan</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="h-8 gap-1.5 text-muted-foreground"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Arsipkan</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            className="h-8 gap-1.5 text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus</span>
          </Button>
        </div>
      </div>

      {/* Global Action Error Banner */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Archived Banner */}
      {isArchived && (
        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Mata Kuliah / Semester Diarsipkan (Hanya-Baca)</AlertTitle>
          <AlertDescription className="mt-1">
            Konten tugas dan catatan pada mata kuliah ini bersifat hanya-baca. Pulihkan mata kuliah dan semester untuk menambahkan atau mengedit konten kembali.
          </AlertDescription>
        </Alert>
      )}

      {/* 2. Informasi Utama Mata Kuliah */}
      <Card className="shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl break-words">
              {course.name}
            </CardTitle>
            {course.code && (
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                {course.code}
              </Badge>
            )}
            {isArchived ? (
              <Badge variant="secondary" className="text-xs text-muted-foreground shrink-0">
                Arsip
              </Badge>
            ) : (
              <Badge variant="default" className="text-xs shrink-0">
                Aktif
              </Badge>
            )}
          </div>
          <CardDescription className="mt-1 text-sm text-muted-foreground">
            Informasi dan keterhubungan materi, tugas, serta catatan kuliah.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pt-0 space-y-5">
          {/* Metadata Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-3 min-w-0">
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

            <div className="flex items-center gap-3 min-w-0">
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

            <div className="flex items-center gap-3 min-w-0">
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
            <div className="border-t border-border pt-4">
              <h2 className="text-sm font-semibold text-foreground">Deskripsi / Silabus</h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground break-words">
                {course.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Jadwal Perkuliahan Terstruktur */}
      <Card className="shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-base font-semibold text-foreground">
                Jadwal Perkuliahan
              </CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              Sesi kelas mingguan terstruktur untuk mata kuliah ini.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
              <Link href={`/schedule?courseId=${course.id}&semesterId=${course.semesterId}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Buka di Jadwal Mingguan</span>
              </Link>
            </Button>
            {!isArchived && (
              <Button
                size="sm"
                onClick={() => setIsCreateScheduleOpen(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah jadwal</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
          {/* Status Banner Konflik */}
          {scheduleConflictBanner && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{scheduleConflictBanner}</AlertDescription>
            </Alert>
          )}

          {isSchedulesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center">
              <CalendarClock className="h-7 w-7 text-muted-foreground mx-auto" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">Belum ada sesi jadwal perkuliahan</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                Tambahkan sesi mingguan (hari, rentang jam, dan ruangan) untuk mata kuliah ini.
              </p>
              {!isArchived && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCreateScheduleOpen(true)}
                  className="mt-3 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah jadwal pertama</span>
                </Button>
              )}
            </div>
          ) : (
            <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schedules.map((sched) => {
                const dayName = getDayNameId(sched.dayOfWeek);
                return (
                  <StaggerItem
                    key={sched.id}
                    className={`flex flex-col justify-between rounded-lg border p-3.5 transition-all ${
                      sched.hasConflict
                        ? 'border-amber-300 dark:border-amber-800 bg-amber-500/5'
                        : 'border-border bg-muted/20 hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {dayName}
                        </span>
                        {sched.hasConflict && (
                          <Badge variant="warning" className="gap-1 text-xs py-0 px-1.5">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Konflik waktu</span>
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-mono font-medium tabular-nums text-foreground">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{sched.startTime} – {sched.endTime}</span>
                      </div>

                      {sched.room ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-foreground truncate">{sched.room}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Ruangan belum ditentukan
                        </p>
                      )}

                      {sched.hasConflict && sched.conflicts && sched.conflicts.length > 0 && (
                        <div className="mt-1 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-2 text-xs text-amber-800 dark:text-amber-300">
                          <p className="font-medium">Bertabrakan dengan:</p>
                          <ul className="mt-0.5 list-disc list-inside space-y-0.5">
                            {sched.conflicts.map((c) => (
                              <li key={c.id}>
                                {c.courseName} ({c.startTime}–{c.endTime})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {!isArchived && (
                      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/50 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSchedule(sched);
                            setIsEditScheduleOpen(true);
                          }}
                          className="h-7 px-2 text-xs gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingSchedule(sched);
                            setIsDeleteScheduleOpen(true);
                          }}
                          className="h-7 px-2 text-xs gap-1 text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Hapus</span>
                        </Button>
                      </div>
                    )}
                  </StaggerItem>
                );
              })}
            </StaggerGroup>
          )}
        </CardContent>
      </Card>

      {/* 4. Tabs Navigation Berbasis WAI-ARIA & Keyboard Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="assignments" className="gap-2">
            <ListTodo className="h-4 w-4" />
            <span>Tugas ({assignments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="h-4 w-4" />
            <span>Catatan ({notes.length})</span>
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-2">
            <FileUp className="h-4 w-4" />
            <span>Materi ({materials.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Tugas */}
        <TabsContent value="assignments" className="space-y-4">
          <AnimatedPanel panelKey="assignments" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Daftar Tugas Kuliah</h2>
                <p className="text-xs text-muted-foreground">
                  Tenggat waktu dan status tugas yang terhubung dengan mata kuliah ini.
                </p>
              </div>
              <Button
                size="standard"
                onClick={() => {
                  setCreateAsgTitle('');
                  setCreateAsgDesc('');
                  setCreateAsgDueDate('');
                  setCreateAsgPriority('MEDIUM');
                  setCreateAsgError(null);
                  setIsCreateAsgOpen(true);
                }}
                disabled={isArchived}
                className="gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah tugas</span>
              </Button>
            </div>

            {isAssignmentsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-10">
                <ListTodo className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden="true" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">Belum ada tugas pada mata kuliah ini</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Tambahkan tugas untuk mencatat deadline praktikum, proyek akhir, atau kuis.
                </p>
                {!isArchived && (
                  <Button
                    size="standard"
                    variant="outline"
                    onClick={() => setIsCreateAsgOpen(true)}
                    className="mt-4 gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah tugas pertama</span>
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Assignments Table */}
                <Card className="hidden md:block overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="px-4 py-3 w-12 text-center text-xs font-semibold uppercase">
                          Status
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Judul Tugas
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Tenggat Waktu
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Prioritas
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((asg) => {
                        const isDone = asg.status === 'DONE';
                        const isPending = pendingAssignmentIds.has(asg.id);

                        return (
                          <TableRow key={asg.id}>
                            <TableCell className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleAssignmentStatus(asg)}
                                disabled={isArchived || isPending}
                                className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
                                title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                                aria-label={`Tandai tugas ${asg.title} ${isDone ? 'belum selesai' : 'selesai'}`}
                              >
                                {isPending ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                ) : isDone ? (
                                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                ) : (
                                  <Circle className="h-5 w-5 hover:text-primary" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="px-4 py-3 max-w-[360px]">
                              <span className={`font-medium break-words ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                {asg.title}
                              </span>
                              {asg.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 break-words">{asg.description}</p>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                              {formatUserDateTime(asg.dueDate, timezone)}
                              {asg.isOverdue && !isDone && (
                                <span className="block text-danger font-semibold mt-0.5">Terlambat</span>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap">
                              <Badge
                                variant={asg.priority === 'HIGH' ? 'danger' : asg.priority === 'MEDIUM' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {asg.priority === 'HIGH' ? 'Tinggi' : asg.priority === 'MEDIUM' ? 'Sedang' : 'Rendah'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>

                {/* Mobile Assignments Cards */}
                <div className="grid gap-2.5 md:hidden">
                  {assignments.map((asg) => {
                    const isDone = asg.status === 'DONE';
                    const isPending = pendingAssignmentIds.has(asg.id);

                    return (
                      <Card
                        key={asg.id}
                        className="p-3.5 shadow-xs flex items-start gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleAssignmentStatus(asg)}
                          disabled={isArchived || isPending}
                          className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 mt-0.5 shrink-0"
                          aria-label={`Tandai tugas ${asg.title} ${isDone ? 'belum selesai' : 'selesai'}`}
                        >
                          {isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className="h-5 w-5 hover:text-primary" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium break-words ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {asg.title}
                            </p>
                            <Badge
                              variant={asg.priority === 'HIGH' ? 'danger' : asg.priority === 'MEDIUM' ? 'default' : 'secondary'}
                              className="text-xs shrink-0"
                            >
                              {asg.priority === 'HIGH' ? 'Tinggi' : asg.priority === 'MEDIUM' ? 'Sedang' : 'Rendah'}
                            </Badge>
                          </div>

                          {asg.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 break-words">
                              {asg.description}
                            </p>
                          )}

                          <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                            {formatUserDateTime(asg.dueDate, timezone)}
                            {asg.isOverdue && !isDone && (
                              <span className="text-danger font-semibold ml-1.5">Terlambat</span>
                            )}
                          </p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </AnimatedPanel>
        </TabsContent>

        {/* Tab 2: Catatan */}
        <TabsContent value="notes" className="space-y-4">
          <AnimatedPanel panelKey="notes" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Daftar Catatan Mata Kuliah</h2>
                <p className="text-xs text-muted-foreground">
                  Rangkuman materi dan catatan belajar yang terorganisasi.
                </p>
              </div>
              <Button
                size="standard"
                onClick={() => {
                  setCreateNoteTitle('');
                  setCreateNoteContent('');
                  setCreateNoteError(null);
                  setIsCreateNoteOpen(true);
                }}
                disabled={isArchived}
                className="gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Buat catatan</span>
              </Button>
            </div>

            {isNotesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-10">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden="true" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">Belum ada catatan untuk mata kuliah ini</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Tulis rangkuman materi perkuliahan dengan format Markdown yang rapi.
                </p>
                {!isArchived && (
                  <Button
                    size="standard"
                    variant="outline"
                    onClick={() => setIsCreateNoteOpen(true)}
                    className="mt-4 gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Buat catatan pertama</span>
                  </Button>
                )}
              </div>
            ) : (
              <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {notes.map((n) => (
                  <StaggerItem key={n.id}>
                    <Card className="h-full shadow-xs flex flex-col justify-between hover:border-primary/50 transition-colors">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium leading-snug">
                          <Link
                            href={`/notes/${n.id}`}
                            className="text-foreground hover:text-primary transition-colors line-clamp-2 break-words"
                          >
                            {n.title}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>Diperbarui: {formatUserDateTime(n.updatedAt, timezone)}</span>
                        </p>
                      </CardContent>
                      <CardFooter className="p-4 pt-2.5 border-t border-border justify-end">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link href={`/notes/${n.id}`}>
                            Buka Editor
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            )}
          </AnimatedPanel>
        </TabsContent>

        {/* Tab 3: Materi */}
        <TabsContent value="materials" className="space-y-4">
          <AnimatedPanel panelKey="materials" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Daftar Materi PDF</h2>
                <p className="text-xs text-muted-foreground">
                  File PDF perkuliahan untuk ekstraksi otomatis dan ringkasan AI.
                </p>
              </div>
              <Button
                size="standard"
                onClick={() => setIsUploadOpen(true)}
                disabled={isArchived}
                className="gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <FileUp className="h-4 w-4" />
                <span>Unggah materi</span>
              </Button>
            </div>

            {isMaterialsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : materials.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-10">
                <FileUp className="h-8 w-8 text-muted-foreground mx-auto" aria-hidden="true" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">Belum ada materi untuk mata kuliah ini</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Unggah dokumen PDF kuliah untuk ekstraksi teks, ringkasan, flashcard, dan kuis.
                </p>
                {!isArchived && (
                  <Button
                    size="standard"
                    variant="outline"
                    onClick={() => setIsUploadOpen(true)}
                    className="mt-4 gap-1.5"
                  >
                    <FileUp className="h-4 w-4" />
                    <span>Unggah materi sekarang</span>
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Materials Table */}
                <Card className="hidden md:block overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Judul Materi
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Ukuran & Halaman
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Status
                        </TableHead>
                        <TableHead className="px-4 py-3 text-xs font-semibold uppercase">
                          Tanggal Unggah
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right text-xs font-semibold uppercase">
                          Aksi
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="px-4 py-3 max-w-[320px]">
                            <Link
                              href={`/materials/${m.id}`}
                              className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2 break-words"
                            >
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="break-words">{m.title}</span>
                            </Link>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 ml-6 break-words">
                              {m.originalFilename}
                            </p>
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                            <div>{formatFileSize(m.bytes)}</div>
                            {m.pageCount ? (
                              <div className="text-xs text-muted-foreground/80">{m.pageCount} halaman</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <MaterialStatusBadge status={m.status} />
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                            {formatUserDateTime(m.createdAt, timezone)}
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap text-right">
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2.5 text-xs">
                              <Link href={`/materials/${m.id}`}>
                                Lihat
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Mobile Materials Cards */}
                <div className="grid gap-2.5 md:hidden">
                  {materials.map((m) => (
                    <Card
                      key={m.id}
                      className="p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/materials/${m.id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors text-sm line-clamp-1 flex items-center gap-1.5 break-words flex-1 min-w-0"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="break-words">{m.title}</span>
                        </Link>
                        <MaterialStatusBadge status={m.status} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                        <span>{formatFileSize(m.bytes)} {m.pageCount ? `• ${m.pageCount} hal` : ''}</span>
                        <span>{formatUserDateTime(m.createdAt, timezone)}</span>
                      </div>

                      <div className="border-t border-border pt-2 flex justify-end">
                        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          <Link href={`/materials/${m.id}`}>
                            Lihat Materi
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </AnimatedPanel>
        </TabsContent>
      </Tabs>

      {/* Edit Course Dialog */}
      <EditCourseDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        course={course}
        onSuccess={(updated) => {
          setCourse(updated);
          router.refresh();
        }}
      />

      {/* Delete Course Dialog */}
      <DeleteCourseDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        course={course}
        onSuccess={() => {
          router.push('/courses');
          router.refresh();
        }}
      />

      {/* Upload Material Dialog */}
      <MaterialUploadDialog
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        courses={course ? [course] : []}
        initialCourseId={courseId}
        onSuccess={() => {
          fetchMaterialsData();
          router.refresh();
        }}
      />

      {/* Modal Tambah Tugas untuk Mata Kuliah ini */}
      <Dialog open={isCreateAsgOpen} onOpenChange={setIsCreateAsgOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <DialogHeader>
            <DialogTitle>Tambah Tugas untuk {course.name}</DialogTitle>
            <DialogDescription>
              Catat tugas perkuliahan baru dengan tenggat waktu dan tingkat prioritas.
            </DialogDescription>
          </DialogHeader>

          {createAsgError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{createAsgError}</AlertDescription>
            </Alert>
          )}

          <form noValidate onSubmit={handleCreateAssignment} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="course-asg-title">Judul Tugas *</Label>
              <Input
                id="course-asg-title"
                placeholder="Contoh: Makalah Pertemuan 4"
                value={createAsgTitle}
                onChange={(e) => setCreateAsgTitle(e.target.value)}
                disabled={isSubmittingAsg}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-due">Tenggat Waktu *</Label>
              <DateTimePicker
                id="course-asg-due"
                value={createAsgDueDate}
                onChange={setCreateAsgDueDate}
                disabled={isSubmittingAsg}
                required
                timezone={timezone}
              />
              <p className="text-xs text-muted-foreground">
                Zona waktu profil: <strong className="text-foreground">{timezone}</strong>. Jika jam tidak ditentukan, deadline otomatis diatur ke 23.59.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-priority">Prioritas *</Label>
              <Select
                value={createAsgPriority}
                onValueChange={(val) => setCreateAsgPriority(val as any)}
                disabled={isSubmittingAsg}
              >
                <SelectTrigger id="course-asg-priority" className="w-full">
                  <SelectValue placeholder="Pilih prioritas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Rendah</SelectItem>
                  <SelectItem value="MEDIUM">Sedang</SelectItem>
                  <SelectItem value="HIGH">Tinggi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-asg-desc">Deskripsi (Opsional)</Label>
              <Textarea
                id="course-asg-desc"
                placeholder="Petunjuk tugas, tautan pengumpulan, atau catatan tambahan..."
                value={createAsgDesc}
                onChange={(e) => setCreateAsgDesc(e.target.value)}
                disabled={isSubmittingAsg}
                rows={3}
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="standard"
                onClick={() => setIsCreateAsgOpen(false)}
                disabled={isSubmittingAsg}
              >
                Batal
              </Button>
              <Button type="submit" size="standard" disabled={isSubmittingAsg}>
                {isSubmittingAsg ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
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

      {/* Modal Tambah Catatan untuk Mata Kuliah ini */}
      <Dialog open={isCreateNoteOpen} onOpenChange={setIsCreateNoteOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Catatan untuk {course.name}</DialogTitle>
            <DialogDescription>
              Tulis catatan belajar baru yang terhubung ke mata kuliah ini.
            </DialogDescription>
          </DialogHeader>

          {createNoteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{createNoteError}</AlertDescription>
            </Alert>
          )}

          <form noValidate onSubmit={handleCreateNote} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="course-note-title">Judul Catatan *</Label>
              <Input
                id="course-note-title"
                placeholder="Contoh: Rangkuman Bab 1 Dasar Teori"
                value={createNoteTitle}
                onChange={(e) => setCreateNoteTitle(e.target.value)}
                disabled={isSubmittingNote}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-note-content">Konten Awal Markdown (Opsional)</Label>
              <Textarea
                id="course-note-content"
                placeholder="# Topik Perkuliahan&#10;&#10;Tulis poin penting perkuliahan di sini..."
                value={createNoteContent}
                onChange={(e) => setCreateNoteContent(e.target.value)}
                disabled={isSubmittingNote}
                rows={4}
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="standard"
                onClick={() => setIsCreateNoteOpen(false)}
                disabled={isSubmittingNote}
              >
                Batal
              </Button>
              <Button type="submit" size="standard" disabled={isSubmittingNote}>
                {isSubmittingNote ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
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

      {/* Modal Tambah Jadwal untuk Mata Kuliah ini */}
      {course && (
        <CreateScheduleDialog
          open={isCreateScheduleOpen}
          onOpenChange={setIsCreateScheduleOpen}
          courses={[course]}
          preselectedCourseId={course.id}
          onSuccess={handleScheduleCreated}
        />
      )}

      {/* Modal Edit Jadwal */}
      <EditScheduleDialog
        open={isEditScheduleOpen}
        onOpenChange={(open) => {
          setIsEditScheduleOpen(open);
          if (!open) setEditingSchedule(null);
        }}
        schedule={editingSchedule}
        onSuccess={handleScheduleUpdated}
      />

      {/* Modal Hapus Jadwal */}
      <DeleteScheduleDialog
        open={isDeleteScheduleOpen}
        onOpenChange={(open) => {
          setIsDeleteScheduleOpen(open);
          if (!open) setDeletingSchedule(null);
        }}
        schedule={deletingSchedule}
        onSuccess={handleScheduleDeleted}
      />
    </FadeIn>
  );
}
