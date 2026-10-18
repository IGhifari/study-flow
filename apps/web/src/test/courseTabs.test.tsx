// @vitest-environment happy-dom
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Assignment, NoteListItem, MaterialListItem, CourseSchedule, Course } from '@studyflow/shared';
import { CourseAssignmentsTab } from '@/components/courses/course-assignments-tab';
import { CourseNotesTab } from '@/components/courses/course-notes-tab';
import { CourseMaterialsTab } from '@/components/courses/course-materials-tab';
import { CourseSchedulesSection } from '@/components/courses/course-schedules-section';

// Mock animasi framer-motion agar rendering di happy-dom deterministik tanpa RAF loop
vi.mock('@/components/ui/motion', () => ({
  StaggerGroup: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerItem: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  FadeIn: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

describe('Course Tabs Behavioral Tests', () => {
  const defaultTimezone = 'Asia/Jakarta';

  const mockCourse: Course = {
    id: 'course-101',
    code: 'CS101',
    name: 'Algoritma & Pemrograman',
    lecturer: 'Dr. John Doe',
    description: 'Mata kuliah dasar algoritma',
    semesterId: 'sem-1',
    userId: 'user-1',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  describe('1. CourseAssignmentsTab', () => {
    const mockAssignment: Assignment = {
      id: 'asg-1',
      courseId: 'course-101',
      title: 'Tugas Algoritma 1',
      description: 'Implementasi Sorting & Searching',
      dueDate: '2026-10-25T17:00:00.000Z',
      priority: 'HIGH',
      status: 'TODO',
      completedAt: null,
      isOverdue: false,
      userId: 'user-1',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    it('merender EmptyState ketika daftar tugas kosong', () => {
      const handleAddAssignment = vi.fn();

      render(
        <CourseAssignmentsTab
          assignments={[]}
          isLoading={false}
          isArchived={false}
          timezone={defaultTimezone}
          pendingAssignmentIds={new Set()}
          onToggleStatus={vi.fn()}
          onAddAssignment={handleAddAssignment}
        />
      );

      // Verifikasi EmptyState
      expect(screen.getByRole('heading', { level: 3, name: 'Belum ada tugas pada mata kuliah ini' })).toBeDefined();
      expect(screen.getByText(/Tambahkan tugas untuk mencatat deadline/i)).toBeDefined();

      // CTA di EmptyState dapat diklik
      const emptyStateCta = screen.getByRole('button', { name: 'Tambah tugas pertama' });
      fireEvent.click(emptyStateCta);
      expect(handleAddAssignment).toHaveBeenCalledTimes(1);
    });

    it('menyembunyikan aksi tambah tugas ketika mata kuliah diarsipkan (isArchived)', () => {
      render(
        <CourseAssignmentsTab
          assignments={[]}
          isLoading={false}
          isArchived={true}
          timezone={defaultTimezone}
          pendingAssignmentIds={new Set()}
          onToggleStatus={vi.fn()}
          onAddAssignment={vi.fn()}
        />
      );

      // Tombol tambah di header harus disabled
      const headerButton = screen.getByRole('button', { name: 'Tambah tugas' });
      expect((headerButton as HTMLButtonElement).disabled).toBe(true);

      // Tombol tambah pertama di EmptyState tidak boleh muncul
      expect(screen.queryByRole('button', { name: 'Tambah tugas pertama' })).toBeNull();
    });

    it('merender data tugas dan memicu onToggleStatus saat status diklik', () => {
      const handleToggleStatus = vi.fn();

      render(
        <CourseAssignmentsTab
          assignments={[mockAssignment]}
          isLoading={false}
          isArchived={false}
          timezone={defaultTimezone}
          pendingAssignmentIds={new Set()}
          onToggleStatus={handleToggleStatus}
          onAddAssignment={vi.fn()}
        />
      );

      // Data tugas tampil
      expect(screen.getAllByText('Tugas Algoritma 1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Implementasi Sorting & Searching').length).toBeGreaterThan(0);

      // Klik tombol toggle status
      const toggleButtons = screen.getAllByRole('button', { name: /Tandai tugas .* selesai/i });
      expect(toggleButtons.length).toBeGreaterThan(0);
      fireEvent.click(toggleButtons[0]);
      expect(handleToggleStatus).toHaveBeenCalledWith(mockAssignment);
    });
  });

  describe('2. CourseNotesTab', () => {
    const mockNote: NoteListItem = {
      id: 'note-1',
      courseId: 'course-101',
      title: 'Rangkuman Minggu 1 - Kompleksitas Waktu',
      isPinned: false,
      userId: 'user-1',
      version: 1,
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    };

    it('merender EmptyState saat catatan kosong dan memanggil onAddNote', () => {
      const handleAddNote = vi.fn();

      render(
        <CourseNotesTab
          notes={[]}
          isLoading={false}
          isArchived={false}
          timezone={defaultTimezone}
          onAddNote={handleAddNote}
        />
      );

      expect(screen.getByRole('heading', { level: 3, name: 'Belum ada catatan untuk mata kuliah ini' })).toBeDefined();

      const cta = screen.getByRole('button', { name: 'Buat catatan pertama' });
      fireEvent.click(cta);
      expect(handleAddNote).toHaveBeenCalledTimes(1);
    });

    it('menonaktifkan penambahan catatan jika mata kuliah diarsipkan', () => {
      render(
        <CourseNotesTab
          notes={[]}
          isLoading={false}
          isArchived={true}
          timezone={defaultTimezone}
          onAddNote={vi.fn()}
        />
      );

      const headerBtn = screen.getByRole('button', { name: 'Buat catatan' });
      expect((headerBtn as HTMLButtonElement).disabled).toBe(true);
      expect(screen.queryByRole('button', { name: 'Buat catatan pertama' })).toBeNull();
    });

    it('merender daftar kartu catatan saat data tersedia', () => {
      render(
        <CourseNotesTab
          notes={[mockNote]}
          isLoading={false}
          isArchived={false}
          timezone={defaultTimezone}
          onAddNote={vi.fn()}
        />
      );

      expect(screen.getByText('Rangkuman Minggu 1 - Kompleksitas Waktu')).toBeDefined();
      expect(screen.getByRole('link', { name: /Buka Editor/i })).toBeDefined();
    });
  });

  describe('3. CourseMaterialsTab', () => {
    const mockMaterial: MaterialListItem = {
      id: 'mat-1',
      courseId: 'course-101',
      title: 'Slide Kuliah 01 - Pengantar Algoritma.pdf',
      originalFilename: 'pengantar-algoritma.pdf',
      mimeType: 'application/pdf',
      bytes: 2048576,
      status: 'READY',
      isPinned: false,
      userId: 'user-1',
      createdAt: '2026-10-03T00:00:00.000Z',
      updatedAt: '2026-10-03T00:00:00.000Z',
    };

    it('merender EmptyState saat materi kosong dan memanggil onUploadMaterial', () => {
      const handleUpload = vi.fn();

      render(
        <CourseMaterialsTab
          materials={[]}
          isLoading={false}
          isArchived={false}
          timezone={defaultTimezone}
          onUploadMaterial={handleUpload}
        />
      );

      expect(screen.getByRole('heading', { level: 3, name: 'Belum ada materi untuk mata kuliah ini' })).toBeDefined();

      const cta = screen.getByRole('button', { name: 'Unggah materi sekarang' });
      fireEvent.click(cta);
      expect(handleUpload).toHaveBeenCalledTimes(1);
    });

    it('menonaktifkan upload materi jika mata kuliah diarsipkan', () => {
      render(
        <CourseMaterialsTab
          materials={[]}
          isLoading={false}
          isArchived={true}
          timezone={defaultTimezone}
          onUploadMaterial={vi.fn()}
        />
      );

      const headerBtn = screen.getByRole('button', { name: 'Unggah materi' });
      expect((headerBtn as HTMLButtonElement).disabled).toBe(true);
      expect(screen.queryByRole('button', { name: 'Unggah materi sekarang' })).toBeNull();
    });

    it('merender daftar materi saat data tersedia', () => {
      render(
        <CourseMaterialsTab
          materials={[mockMaterial]}
          isLoading={false}
          isArchived={false}
          timezone={defaultTimezone}
          onUploadMaterial={vi.fn()}
        />
      );

      expect(screen.getAllByText('Slide Kuliah 01 - Pengantar Algoritma.pdf').length).toBeGreaterThan(0);
    });
  });

  describe('4. CourseSchedulesSection', () => {
    const mockSchedule: CourseSchedule = {
      id: 'sched-1',
      userId: 'user-1',
      courseId: 'course-101',
      dayOfWeek: 1, // Senin
      startTime: '08:00',
      endTime: '09:40',
      room: 'Ruang Lab 304',
      hasConflict: false,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    it('merender EmptyState compact saat jadwal kosong dan memanggil onAddSchedule', () => {
      const handleAddSchedule = vi.fn();

      render(
        <CourseSchedulesSection
          course={mockCourse}
          schedules={[]}
          isLoading={false}
          isArchived={false}
          conflictBanner={null}
          onAddSchedule={handleAddSchedule}
          onEditSchedule={vi.fn()}
          onDeleteSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('Belum ada sesi jadwal perkuliahan')).toBeDefined();

      const cta = screen.getByRole('button', { name: 'Tambah jadwal pertama' });
      fireEvent.click(cta);
      expect(handleAddSchedule).toHaveBeenCalledTimes(1);
    });

    it('menyembunyikan tombol tambah, edit, dan hapus ketika isArchived: true', () => {
      render(
        <CourseSchedulesSection
          course={{ ...mockCourse, archivedAt: '2026-10-01T00:00:00.000Z' }}
          schedules={[mockSchedule]}
          isLoading={false}
          isArchived={true}
          conflictBanner={null}
          onAddSchedule={vi.fn()}
          onEditSchedule={vi.fn()}
          onDeleteSchedule={vi.fn()}
        />
      );

      // Header tombol tambah tidak muncul
      expect(screen.queryByRole('button', { name: 'Tambah jadwal' })).toBeNull();

      // Tombol edit dan hapus sesi tidak boleh muncul pada mata kuliah terarsip
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hapus' })).toBeNull();
    });

    it('merender sesi jadwal dan memicu callback edit serta delete', () => {
      const handleEdit = vi.fn();
      const handleDelete = vi.fn();

      render(
        <CourseSchedulesSection
          course={mockCourse}
          schedules={[mockSchedule]}
          isLoading={false}
          isArchived={false}
          conflictBanner={null}
          onAddSchedule={vi.fn()}
          onEditSchedule={handleEdit}
          onDeleteSchedule={handleDelete}
        />
      );

      // Verifikasi konten sesi
      expect(screen.getByText('Senin')).toBeDefined();
      expect(screen.getByText(/08:00\s*[–-]\s*09:40/)).toBeDefined();
      expect(screen.getByText('Ruang Lab 304')).toBeDefined();

      // Interaksi tombol Edit
      const editBtn = screen.getByRole('button', { name: 'Edit' });
      fireEvent.click(editBtn);
      expect(handleEdit).toHaveBeenCalledWith(mockSchedule);

      // Interaksi tombol Hapus
      const deleteBtn = screen.getByRole('button', { name: 'Hapus' });
      fireEvent.click(deleteBtn);
      expect(handleDelete).toHaveBeenCalledWith(mockSchedule);
    });

    it('merender banner konflik jadwal jika diberikan', () => {
      render(
        <CourseSchedulesSection
          course={mockCourse}
          schedules={[mockSchedule]}
          isLoading={false}
          isArchived={false}
          conflictBanner="Peringatan: Jadwal bentrok dengan mata kuliah lain pada hari Senin pukul 08:00."
          onAddSchedule={vi.fn()}
          onEditSchedule={vi.fn()}
          onDeleteSchedule={vi.fn()}
        />
      );

      expect(screen.getByText(/Jadwal bentrok dengan mata kuliah lain/i)).toBeDefined();
    });
  });
});
