'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ListTodo,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  Calendar,
  BookOpen,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  Assignment,
  Course,
  Semester,
  UserProfile,
  formatUserDateTime,
  toUserDateTimeInputValue,
} from '@studyflow/shared';
import {
  listAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from '@/lib/assignment-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { getProfile } from '@/lib/auth-client';
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

export default function AssignmentsPage(): React.JSX.Element {
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [semesters, setSemesters] = React.useState<Semester[]>([]);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

  // Filters
  const [selectedSemesterId, setSelectedSemesterId] = React.useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>('all');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = React.useState<string>('ALL');
  const [isOverdueOnly, setIsOverdueOnly] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createCourseId, setCreateCourseId] = React.useState('');
  const [createTitle, setCreateTitle] = React.useState('');
  const [createDescription, setCreateDescription] = React.useState('');
  const [createDueDate, setCreateDueDate] = React.useState('');
  const [createPriority, setCreatePriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [createStatus, setCreateStatus] = React.useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = React.useState(false);

  // Modal Edit
  const [editingAssignment, setEditingAssignment] = React.useState<Assignment | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editDueDate, setEditDueDate] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [editStatus, setEditStatus] = React.useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);

  // Modal Delete
  const [deletingAssignment, setDeletingAssignment] = React.useState<Assignment | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = React.useState(false);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  // Load initial metadata: Profile, Semesters, Courses
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
        console.error('Failed to load initial metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch Assignments
  const fetchAssignments = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await listAssignments({
        semesterId: selectedSemesterId === 'all' ? undefined : selectedSemesterId,
        courseId: selectedCourseId === 'all' ? undefined : selectedCourseId,
        status: selectedStatus === 'ALL' ? undefined : (selectedStatus as any),
        priority: selectedPriority === 'ALL' ? undefined : (selectedPriority as any),
        isOverdue: isOverdueOnly ? true : undefined,
        search: searchQuery.trim() || undefined,
        sortBy: 'dueDate',
        sortOrder,
        limit: 100,
      });
      setAssignments(data.assignments);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat tugas kuliah.');
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedSemesterId,
    selectedCourseId,
    selectedStatus,
    selectedPriority,
    isOverdueOnly,
    searchQuery,
    sortOrder,
  ]);

  React.useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setCreateTitle('');
    setCreateDescription('');
    setCreateDueDate('');
    setCreatePriority('MEDIUM');
    setCreateStatus('TODO');
    setCreateError(null);

    // Pick first non-archived course if available
    const activeCourses = courses.filter((c) => !c.archivedAt);
    setCreateCourseId(activeCourses.length > 0 ? activeCourses[0]!.id : '');
    setIsCreateOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) {
      setCreateError('Judul tugas wajib diisi');
      return;
    }
    if (!createCourseId) {
      setCreateError('Mata kuliah wajib dipilih');
      return;
    }
    if (!createDueDate) {
      setCreateError('Tanggal tenggat waktu wajib diisi');
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      await createAssignment({
        courseId: createCourseId,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        dueDate: createDueDate,
        priority: createPriority,
        status: createStatus,
      });
      setIsCreateOpen(false);
      fetchAssignments();
    } catch (err: any) {
      setCreateError(err.message || 'Gagal menambahkan tugas baru.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (asg: Assignment) => {
    setEditingAssignment(asg);
    setEditTitle(asg.title);
    setEditDescription(asg.description || '');
    setEditDueDate(toUserDateTimeInputValue(asg.dueDate, timezone));
    setEditPriority(asg.priority);
    setEditStatus(asg.status);
    setEditError(null);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    if (!editTitle.trim()) {
      setEditError('Judul tugas wajib diisi');
      return;
    }
    if (!editDueDate) {
      setEditError('Tenggat waktu wajib diisi');
      return;
    }

    setIsSubmittingEdit(true);
    setEditError(null);
    try {
      await updateAssignment(editingAssignment.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        dueDate: editDueDate,
        priority: editPriority,
        status: editStatus,
      });
      setEditingAssignment(null);
      fetchAssignments();
    } catch (err: any) {
      setEditError(err.message || 'Gagal memperbarui tugas.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Quick Toggle Status TODO/IN_PROGRESS <-> DONE
  const handleToggleStatus = async (asg: Assignment) => {
    const nextStatus = asg.status === 'DONE' ? 'TODO' : 'DONE';
    try {
      await updateAssignment(asg.id, { status: nextStatus });
      fetchAssignments();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status tugas');
    }
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    if (!deletingAssignment) return;
    setIsSubmittingDelete(true);
    setDeleteError(null);
    try {
      await deleteAssignment(deletingAssignment.id);
      setDeletingAssignment(null);
      fetchAssignments();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus tugas.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const activeCourses = courses.filter((c) => !c.archivedAt);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
            <ListTodo className="h-7 w-7 text-primary" aria-hidden="true" />
            Tugas Kuliah
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola daftar tugas dengan prioritas, tenggat waktu, dan status pengerjaan.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          disabled={activeCourses.length === 0}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tambah Tugas
        </Button>
      </div>

      {activeCourses.length === 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning-foreground flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Belum ada mata kuliah aktif</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Anda perlu menambahkan mata kuliah aktif terlebih dahulu sebelum dapat mencatat tugas.
            </p>
            <Link href="/courses" className="mt-2 inline-block text-xs font-semibold text-primary underline">
              Kelola Mata Kuliah &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <Card className="p-4 bg-card/60 backdrop-blur-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari judul tugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Semester */}
          <div className="w-full sm:w-[190px]">
            <RadixSelect
              value={selectedSemesterId}
              onValueChange={(val) => setSelectedSemesterId(val)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Semua Semester" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[280px]">
                <SelectItem value="all">Semua Semester</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.isActive ? '(Aktif)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>
          </div>

          {/* Filter Course */}
          <div className="w-full sm:w-[210px]">
            <RadixSelect
              value={selectedCourseId}
              onValueChange={(val) => setSelectedCourseId(val)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Semua Mata Kuliah" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[320px]">
                <SelectItem value="all">Semua Mata Kuliah</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''} {c.archivedAt ? '[Arsip]' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </RadixSelect>
          </div>

          {/* Filter Status */}
          <div className="w-full sm:w-[170px]">
            <RadixSelect
              value={selectedStatus}
              onValueChange={(val) => setSelectedStatus(val)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[240px]">
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="TODO">Belum Dikerjakan</SelectItem>
                <SelectItem value="IN_PROGRESS">Sedang Dikerjakan</SelectItem>
                <SelectItem value="DONE">Selesai</SelectItem>
              </SelectContent>
            </RadixSelect>
          </div>

          {/* Filter Priority & Overdue */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-[180px]">
              <RadixSelect
                value={selectedPriority}
                onValueChange={(val) => setSelectedPriority(val)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Semua Prioritas" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[220px]">
                  <SelectItem value="ALL">Semua Prioritas</SelectItem>
                  <SelectItem value="HIGH">Tinggi (High)</SelectItem>
                  <SelectItem value="MEDIUM">Sedang (Medium)</SelectItem>
                  <SelectItem value="LOW">Rendah (Low)</SelectItem>
                </SelectContent>
              </RadixSelect>
            </div>

            <Button
              variant={isOverdueOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setIsOverdueOnly(!isOverdueOnly)}
              title="Hanya tampilkan tugas terlambat"
              className="h-11 w-11 p-0 shrink-0"
            >
              <Clock className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Urutkan deadline: ${sortOrder === 'asc' ? 'Terdekat' : 'Terjauh'}`}
              className="h-11 w-11 p-0 shrink-0"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Memuat daftar tugas...</p>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-danger" />
          <h3 className="mt-3 text-base font-semibold text-danger">Gagal Memuat Tugas</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md">{errorMsg}</p>
          <Button variant="outline" onClick={() => fetchAssignments()} className="mt-4">
            Coba Lagi
          </Button>
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListTodo className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {searchQuery || selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || isOverdueOnly
              ? 'Tidak ada tugas yang cocok'
              : 'Belum ada tugas kuliah'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {searchQuery || selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || isOverdueOnly
              ? 'Coba sesuaikan kata kunci pencarian atau filter yang dipilih.'
              : 'Mulai dengan menambahkan tugas baru agar Anda dapat memantau deadline belajar.'}
          </p>
          {!(searchQuery || selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || isOverdueOnly) && (
            <Button onClick={handleOpenCreate} disabled={activeCourses.length === 0} className="mt-5">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Tugas Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-12 text-center">Status</th>
                  <th scope="col" className="px-4 py-3.5">Judul & Mata Kuliah</th>
                  <th scope="col" className="px-4 py-3.5">Tenggat Waktu</th>
                  <th scope="col" className="px-4 py-3.5">Prioritas</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assignments.map((asg) => {
                  const isDone = asg.status === 'DONE';
                  const isArchived = Boolean(asg.course?.archivedAt || asg.course?.semester?.archivedAt);

                  return (
                    <tr
                      key={asg.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isDone ? 'bg-muted/10 opacity-75' : ''
                      }`}
                    >
                      {/* Status Toggle Button */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(asg)}
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

                      {/* Title & Course */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span
                            className={`font-medium ${
                              isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {asg.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {asg.course ? (
                              <Link
                                href={`/courses/${asg.course.id}`}
                                className="hover:underline flex items-center gap-1"
                              >
                                <BookOpen className="h-3 w-3" />
                                {asg.course.name}
                              </Link>
                            ) : (
                              <span>Mata Kuliah</span>
                            )}
                            {isArchived && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 border-muted">
                                Arsip (Read-only)
                              </Badge>
                            )}
                          </div>
                          {asg.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                              {asg.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Due Date & Overdue Tag */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs text-foreground font-medium">
                            {formatUserDateTime(asg.dueDate, timezone)}
                          </span>
                          {asg.isOverdue && !isDone && (
                            <div className="flex items-center gap-1 text-xs font-semibold text-danger mt-0.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Terlambat</span>
                            </div>
                          )}
                          {isDone && asg.completedAt && (
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              Selesai: {formatUserDateTime(asg.completedAt, timezone)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge
                          variant={
                            asg.priority === 'HIGH'
                              ? 'danger'
                              : asg.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {asg.priority === 'HIGH'
                            ? 'Tinggi'
                            : asg.priority === 'MEDIUM'
                            ? 'Sedang'
                            : 'Rendah'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(asg)}
                            disabled={isArchived}
                            title={isArchived ? 'Mata kuliah diarsipkan (hanya-baca)' : 'Edit tugas'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingAssignment(asg)}
                            disabled={isArchived}
                            title={isArchived ? 'Mata kuliah diarsipkan (hanya-baca)' : 'Hapus tugas'}
                            className="text-danger-foreground hover:bg-danger/10 hover:text-danger"
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

          {/* Mobile Card List (< 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {assignments.map((asg) => {
              const isDone = asg.status === 'DONE';
              const isArchived = Boolean(asg.course?.archivedAt || asg.course?.semester?.archivedAt);

              return (
                <Card
                  key={asg.id}
                  className={`p-4 transition-colors ${isDone ? 'bg-muted/20 opacity-80' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(asg)}
                      disabled={isArchived}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Circle className="h-6 w-6" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-sm font-semibold ${
                            isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {asg.title}
                        </h4>
                        <Badge
                          variant={
                            asg.priority === 'HIGH'
                              ? 'danger'
                              : asg.priority === 'MEDIUM'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] shrink-0"
                        >
                          {asg.priority === 'HIGH'
                            ? 'Tinggi'
                            : asg.priority === 'MEDIUM'
                            ? 'Sedang'
                            : 'Rendah'}
                        </Badge>
                      </div>

                      {asg.course && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {asg.course.name}
                        </p>
                      )}

                      {asg.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {asg.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatUserDateTime(asg.dueDate, timezone)}</span>
                          {asg.isOverdue && !isDone && (
                            <span className="flex items-center gap-0.5 text-xs font-bold text-danger ml-1">
                              <AlertTriangle className="h-3 w-3" />
                              Terlambat
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(asg)}
                            disabled={isArchived}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingAssignment(asg)}
                            disabled={isArchived}
                            className="text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog Create Assignment */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah Tugas Baru</DialogTitle>
            <DialogDescription>
              Catat tugas kuliah baru beserta tenggat waktu dan tingkat prioritasnya.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="create-title">Judul Tugas *</Label>
              <Input
                id="create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Contoh: Makalah Sistem Terdistribusi"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-course">Mata Kuliah *</Label>
              <NativeSelect
                id="create-course"
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
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-due">Tenggat Waktu *</Label>
              <Input
                id="create-due"
                type="datetime-local"
                value={createDueDate}
                onChange={(e) => setCreateDueDate(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Zona waktu profil: <strong className="text-foreground">{timezone}</strong>. Jika waktu tidak diisi, deadline otomatis diatur ke 23.59.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-priority">Prioritas</Label>
                <NativeSelect
                  id="create-priority"
                  value={createPriority}
                  onChange={(e) => setCreatePriority(e.target.value as any)}
                >
                  <option value="LOW">Rendah (Low)</option>
                  <option value="MEDIUM">Sedang (Medium)</option>
                  <option value="HIGH">Tinggi (High)</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-status">Status</Label>
                <NativeSelect
                  id="create-status"
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as any)}
                >
                  <option value="TODO">Belum Dikerjakan</option>
                  <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                  <option value="DONE">Selesai</option>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-desc">Deskripsi (Opsional)</Label>
              <Textarea
                id="create-desc"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Rincian instruksi tugas, format pengumpulan, dll."
                rows={3}
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

      {/* Dialog Edit Assignment */}
      <Dialog open={Boolean(editingAssignment)} onOpenChange={(open) => !open && setEditingAssignment(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Tugas</DialogTitle>
            <DialogDescription>
              Perbarui judul, tenggat waktu, prioritas, atau status tugas ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {editError && (
              <div className="rounded-md bg-danger/10 p-3 text-xs font-medium text-danger border border-danger/20">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Mata Kuliah</Label>
              <Input
                value={editingAssignment?.course?.name || ''}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                Mata kuliah tidak dapat dipindahkan setelah tugas dibuat.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Judul Tugas *</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-due">Tenggat Waktu *</Label>
              <Input
                id="edit-due"
                type="datetime-local"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Zona waktu: <strong className="text-foreground">{timezone}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority">Prioritas</Label>
                <NativeSelect
                  id="edit-priority"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as any)}
                >
                  <option value="LOW">Rendah (Low)</option>
                  <option value="MEDIUM">Sedang (Medium)</option>
                  <option value="HIGH">Tinggi (High)</option>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <NativeSelect
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                >
                  <option value="TODO">Belum Dikerjakan</option>
                  <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                  <option value="DONE">Selesai</option>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Deskripsi (Opsional)</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingAssignment(null)}
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

      {/* Dialog Confirm Delete */}
      <Dialog open={Boolean(deletingAssignment)} onOpenChange={(open) => !open && setDeletingAssignment(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Hapus Tugas</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus tugas <strong className="text-foreground">{deletingAssignment?.title}</strong>? Tindakan ini tidak dapat dibatalkan.
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
              onClick={() => setDeletingAssignment(null)}
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
                'Hapus Tugas'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
