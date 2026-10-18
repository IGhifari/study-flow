'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ListTodo,
  FileText,
  FileUp,
} from 'lucide-react';
import {
  Course,
  Assignment,
  NoteListItem,
  MaterialListItem,
  UserProfile,
  CourseSchedule,
  CourseScheduleConflict,
} from '@studyflow/shared';
import {
  getCourse,
  archiveCourse,
  unarchiveCourse,
} from '@/lib/course-client';
import {
  listAssignments,
  updateAssignment,
} from '@/lib/assignment-client';
import { listNotes } from '@/lib/note-client';
import { listMaterials } from '@/lib/material-client';
import { listSchedules } from '@/lib/schedule-client';
import { getProfile } from '@/lib/auth-client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FadeIn, AnimatedPanel } from '@/components/ui/motion';
import {
  CourseLoadingSkeleton,
  CourseErrorAlert,
  CourseDetailHeader,
  CourseInfoCard,
  CourseSchedulesSection,
  CourseAssignmentsTab,
  CourseNotesTab,
  CourseMaterialsTab,
  EditCourseDialog,
  DeleteCourseDialog,
} from '@/components/courses';
import { CreateScheduleDialog } from '@/components/schedules/create-schedule-dialog';
import { EditScheduleDialog } from '@/components/schedules/edit-schedule-dialog';
import { DeleteScheduleDialog } from '@/components/schedules/delete-schedule-dialog';
import { MaterialUploadDialog } from '@/components/materials/material-upload-dialog';
import { CourseQuickAssignmentDialog } from '@/features/courses/components/course-quick-assignment-dialog';
import { CourseQuickNoteDialog } from '@/features/courses/components/course-quick-note-dialog';

// Standardized UI-6 Invariants & Component Architecture:
// UI Components: <Card, <CardHeader, <CardTitle, <CardContent
// Data Table: <Table>, <TableHeader, <TableBody>
// Motion: FadeIn, StaggerGroup, StaggerItem, AnimatedPanel

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
  const [assignmentsError, setAssignmentsError] = React.useState<string | null>(null);
  const [pendingAssignmentIds, setPendingAssignmentIds] = React.useState<Set<string>>(new Set());

  // Course Notes state
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);
  const [isNotesLoading, setIsNotesLoading] = React.useState(false);
  const [notesError, setNotesError] = React.useState<string | null>(null);

  // Course Materials state
  const [materials, setMaterials] = React.useState<MaterialListItem[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = React.useState(false);
  const [materialsError, setMaterialsError] = React.useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);

  // Course Schedules state
  const [schedules, setSchedules] = React.useState<CourseSchedule[]>([]);
  const [isSchedulesLoading, setIsSchedulesLoading] = React.useState(false);
  const [schedulesError, setSchedulesError] = React.useState<string | null>(null);
  const [scheduleConflictBanner, setScheduleConflictBanner] = React.useState<string | null>(null);
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<CourseSchedule | null>(null);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = React.useState(false);
  const [deletingSchedule, setDeletingSchedule] = React.useState<CourseSchedule | null>(null);
  const [isDeleteScheduleOpen, setIsDeleteScheduleOpen] = React.useState(false);

  // Dialogs
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isCreateAsgOpen, setIsCreateAsgOpen] = React.useState(false);
  const [isCreateNoteOpen, setIsCreateNoteOpen] = React.useState(false);

  const timezone = userProfile?.timezone || 'Asia/Jakarta';

  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchCourseData = React.useCallback(async () => {
    if (!courseId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profile, courseData] = await Promise.all([
        getProfile().catch(() => null),
        getCourse(courseId),
      ]);
      if (!isMountedRef.current) return;
      if (profile) setUserProfile(profile);
      setCourse(courseData);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat mata kuliah');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [courseId]);

  const fetchAssignmentsData = React.useCallback(async () => {
    if (!courseId) return;
    setIsAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const res = await listAssignments({ courseId, limit: 100 });
      if (!isMountedRef.current) return;
      setAssignments(res.assignments);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error('Failed to load assignments:', err);
      setAssignmentsError(err instanceof Error ? err.message : 'Gagal memuat daftar tugas');
    } finally {
      if (isMountedRef.current) {
        setIsAssignmentsLoading(false);
      }
    }
  }, [courseId]);

  const fetchNotesData = React.useCallback(async () => {
    if (!courseId) return;
    setIsNotesLoading(true);
    setNotesError(null);
    try {
      const res = await listNotes({ courseId, limit: 100 });
      if (!isMountedRef.current) return;
      setNotes(res.notes);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error('Failed to load notes:', err);
      setNotesError(err instanceof Error ? err.message : 'Gagal memuat daftar catatan');
    } finally {
      if (isMountedRef.current) {
        setIsNotesLoading(false);
      }
    }
  }, [courseId]);

  const fetchMaterialsData = React.useCallback(async () => {
    if (!courseId) return;
    setIsMaterialsLoading(true);
    setMaterialsError(null);
    try {
      const res = await listMaterials({ courseId, limit: 100 });
      if (!isMountedRef.current) return;
      setMaterials(res.materials);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error('Failed to load materials:', err);
      setMaterialsError(err instanceof Error ? err.message : 'Gagal memuat daftar materi');
    } finally {
      if (isMountedRef.current) {
        setIsMaterialsLoading(false);
      }
    }
  }, [courseId]);

  const fetchSchedulesData = React.useCallback(async () => {
    if (!courseId) return;
    setIsSchedulesLoading(true);
    setSchedulesError(null);
    try {
      const res = await listSchedules({ courseId });
      if (!isMountedRef.current) return;
      setSchedules(res.schedules);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error('Failed to load schedules:', err);
      setSchedulesError(err instanceof Error ? err.message : 'Gagal memuat jadwal perkuliahan');
    } finally {
      if (isMountedRef.current) {
        setIsSchedulesLoading(false);
      }
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
      const conflictNames = conflicts
        .map((c) => `${c.courseName} (${c.startTime}–${c.endTime})`)
        .join(', ');
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
      const conflictNames = conflicts
        .map((c) => `${c.courseName} (${c.startTime}–${c.endTime})`)
        .join(', ');
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
      if (!isMountedRef.current) return;
      setCourse(updated);
      router.refresh();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setActionError(err instanceof Error ? err.message : 'Gagal mengarsipkan mata kuliah.');
    }
  };

  const handleUnarchive = async () => {
    setActionError(null);
    try {
      const updated = await unarchiveCourse(courseId);
      if (!isMountedRef.current) return;
      setCourse(updated);
      router.refresh();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setActionError(err instanceof Error ? err.message : 'Gagal memulihkan mata kuliah.');
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
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      // Revert optimistic update
      setAssignments((prev) =>
        prev.map((item) => (item.id === asg.id ? asg : item))
      );
      setActionError(err instanceof Error ? err.message : 'Gagal memperbarui status tugas.');
    } finally {
      if (isMountedRef.current) {
        setPendingAssignmentIds((prev) => {
          const next = new Set(prev);
          next.delete(asg.id);
          return next;
        });
      }
    }
  };

  if (isLoading) {
    return <CourseLoadingSkeleton />;
  }

  if (errorMsg || !course) {
    return <CourseErrorAlert errorMsg={errorMsg} />;
  }

  return (
    <FadeIn className="space-y-6">
      {/* 1. Top Navigasi & Aksi Utama */}
      <CourseDetailHeader
        isArchived={isArchived}
        actionError={actionError}
        onEdit={() => setIsEditOpen(true)}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onDelete={() => setIsDeleteOpen(true)}
      />

      {/* 2. Informasi Utama Mata Kuliah */}
      <CourseInfoCard
        course={course}
        isArchived={isArchived}
      />

      {/* 3. Jadwal Perkuliahan Terstruktur */}
      <CourseSchedulesSection
        course={course}
        schedules={schedules}
        isLoading={isSchedulesLoading}
        error={schedulesError}
        onRetry={fetchSchedulesData}
        isArchived={isArchived}
        conflictBanner={scheduleConflictBanner}
        onAddSchedule={() => setIsCreateScheduleOpen(true)}
        onEditSchedule={(sched) => {
          setEditingSchedule(sched);
          setIsEditScheduleOpen(true);
        }}
        onDeleteSchedule={(sched) => {
          setDeletingSchedule(sched);
          setIsDeleteScheduleOpen(true);
        }}
      />

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
            <CourseAssignmentsTab
              assignments={assignments}
              isLoading={isAssignmentsLoading}
              error={assignmentsError}
              onRetry={fetchAssignmentsData}
              isArchived={isArchived}
              timezone={timezone}
              pendingAssignmentIds={pendingAssignmentIds}
              onToggleStatus={handleToggleAssignmentStatus}
              onAddAssignment={() => setIsCreateAsgOpen(true)}
            />
          </AnimatedPanel>
        </TabsContent>

        {/* Tab 2: Catatan */}
        <TabsContent value="notes" className="space-y-4">
          <AnimatedPanel panelKey="notes" className="space-y-4">
            <CourseNotesTab
              notes={notes}
              isLoading={isNotesLoading}
              error={notesError}
              onRetry={fetchNotesData}
              isArchived={isArchived}
              timezone={timezone}
              onAddNote={() => setIsCreateNoteOpen(true)}
            />
          </AnimatedPanel>
        </TabsContent>

        {/* Tab 3: Materi */}
        <TabsContent value="materials" className="space-y-4">
          <AnimatedPanel panelKey="materials" className="space-y-4">
            <CourseMaterialsTab
              materials={materials}
              isLoading={isMaterialsLoading}
              error={materialsError}
              onRetry={fetchMaterialsData}
              isArchived={isArchived}
              timezone={timezone}
              onUploadMaterial={() => setIsUploadOpen(true)}
            />
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
      <CourseQuickAssignmentDialog
        open={isCreateAsgOpen}
        onOpenChange={setIsCreateAsgOpen}
        courseId={courseId}
        courseName={course.name}
        timezone={timezone}
        onSuccess={fetchAssignmentsData}
      />

      {/* Modal Tambah Catatan untuk Mata Kuliah ini */}
      <CourseQuickNoteDialog
        open={isCreateNoteOpen}
        onOpenChange={setIsCreateNoteOpen}
        courseId={courseId}
        courseName={course.name}
        onNoteCreated={(noteId) => router.push(`/notes/${noteId}`)}
      />

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
