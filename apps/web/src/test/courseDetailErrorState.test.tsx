// @vitest-environment happy-dom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type {
  Course,
  Assignment,
  NoteListItem,
  MaterialListItem,
  CourseSchedule,
  UserProfile,
} from '@studyflow/shared';
import CourseDetailPage from '@/app/(dashboard)/courses/[id]/page';
import { getCourse, archiveCourse, unarchiveCourse } from '@/lib/course-client';
import { listAssignments, updateAssignment, type AssignmentListResponse } from '@/lib/assignment-client';
import { listNotes } from '@/lib/note-client';
import { listMaterials } from '@/lib/material-client';
import { listSchedules } from '@/lib/schedule-client';
import { getProfile } from '@/lib/auth-client';

// Mock dependencies
vi.mock('@/lib/course-client', () => ({
  getCourse: vi.fn(),
  archiveCourse: vi.fn(),
  unarchiveCourse: vi.fn(),
}));

vi.mock('@/lib/assignment-client', () => ({
  listAssignments: vi.fn(),
  updateAssignment: vi.fn(),
}));

vi.mock('@/lib/note-client', () => ({
  listNotes: vi.fn(),
}));

vi.mock('@/lib/material-client', () => ({
  listMaterials: vi.fn(),
}));

vi.mock('@/lib/schedule-client', () => ({
  listSchedules: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/components/ui/motion', () => ({
  FadeIn: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AnimatedPanel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerGroup: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerItem: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'course-101' }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('CourseDetailPage - Error States & Resilience Behavioral Tests', () => {
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

  const mockUserProfile: UserProfile = {
    id: 'user-1',
    name: 'Mahasiswa Hebat',
    email: 'student@example.com',
    role: 'USER',
    timezone: 'Asia/Jakarta',
    reminderEmailDeadline: true,
    hasPassword: true,
    providers: ['local'],
    emailVerifiedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const mockAssignment: Assignment = {
    id: 'asg-1',
    courseId: 'course-101',
    title: 'Tugas Algoritma Searching',
    description: 'Implementasi Binary Search Tree',
    dueDate: '2026-10-25T17:00:00.000Z',
    priority: 'HIGH',
    status: 'TODO',
    completedAt: null,
    isOverdue: false,
    userId: 'user-1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const mockNote: NoteListItem = {
    id: 'note-1',
    title: 'Catatan Pertemuan 1 - Pengenalan Big O',
    courseId: 'course-101',
    userId: 'user-1',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const mockMaterial: MaterialListItem = {
    id: 'mat-1',
    title: 'Slide Kuliah Bab 1.pdf',
    originalFilename: 'slide-bab-1.pdf',
    bytes: 1048576,
    mimeType: 'application/pdf',
    pageCount: 12,
    courseId: 'course-101',
    status: 'READY',
    userId: 'user-1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const mockSchedule: CourseSchedule = {
    id: 'sched-1',
    userId: 'user-1',
    courseId: 'course-101',
    dayOfWeek: 1, // Senin
    startTime: '08:00',
    endTime: '10:00',
    room: 'Lab Komputer 3',
    hasConflict: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(getCourse).mockResolvedValue(mockCourse);
    vi.mocked(getProfile).mockResolvedValue(mockUserProfile);
    vi.mocked(listAssignments).mockResolvedValue({
      assignments: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });
    vi.mocked(listNotes).mockResolvedValue({
      notes: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });
    vi.mocked(listMaterials).mockResolvedValue({
      materials: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });
    vi.mocked(listSchedules).mockResolvedValue({ schedules: [], total: 0 });
  });

  it('1. Respons kosong yang sukses menampilkan EmptyState dan tidak menampilkan error alert', async () => {
    render(<CourseDetailPage />);

    // Tunggu course termuat
    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // Empty state pada tab tugas (default tab)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Belum ada tugas pada mata kuliah ini' })
    ).toBeDefined();

    // Pastikan tidak ada alert error
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('2. Kegagalan API tugas menampilkan CourseTabErrorState (alert dan tombol Coba Lagi), bukan EmptyState', async () => {
    vi.mocked(listAssignments).mockRejectedValueOnce(new Error('Koneksi database tugas gagal'));

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // Harus menampilkan role="alert"
    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();

    // Judul dan pesan error spesifik
    expect(screen.getByText('Gagal Memuat Tugas Kuliah')).toBeDefined();
    expect(screen.getByText('Koneksi database tugas gagal')).toBeDefined();

    // Tombol Coba Lagi harus tersedia
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    expect(retryButton).toBeDefined();

    // Empty state TIDAK boleh ditampilkan ketika terjadi error
    expect(screen.queryByText('Belum ada tugas pada mata kuliah ini')).toBeNull();
  });

  it('3. Tombol Coba Lagi memicu pemanggilan ulang (re-fetch) loader terkait', async () => {
    vi.mocked(listAssignments).mockRejectedValue(new Error('Koneksi server gagal'));

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });
    await screen.findByRole('alert');

    expect(listAssignments).toHaveBeenCalledTimes(1);

    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(listAssignments).toHaveBeenCalledTimes(2);
    });
  });

  it('4. Retry yang berhasil memulihkan data tugas dan membersihkan error state', async () => {
    vi.mocked(listAssignments)
      .mockRejectedValueOnce(new Error('Koneksi terputus'))
      .mockResolvedValueOnce({
        assignments: [mockAssignment],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // State error pertama muncul
    await screen.findByRole('alert');
    expect(screen.getByText('Koneksi terputus')).toBeDefined();

    // Klik Coba Lagi
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    fireEvent.click(retryButton);

    // Verifikasi pemulihan: data tugas muncul
    const asgElements = await screen.findAllByText('Tugas Algoritma Searching');
    expect(asgElements.length).toBeGreaterThan(0);

    // Alert error dan empty state sudah tidak ada di layar
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Belum ada tugas pada mata kuliah ini')).toBeNull();
  });

  it('5. Isolasi kegagalan: kegagalan API tugas tidak merusak atau mengosongkan jadwal, catatan, dan materi', async () => {
    // Tugas gagal, tetapi schedules, notes, dan materials memiliki data sukses
    vi.mocked(listAssignments).mockRejectedValueOnce(new Error('Timeout tugas'));
    vi.mocked(listSchedules).mockResolvedValueOnce({ schedules: [mockSchedule], total: 1 });
    vi.mocked(listNotes).mockResolvedValueOnce({
      notes: [mockNote],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
    vi.mocked(listMaterials).mockResolvedValueOnce({
      materials: [mockMaterial],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // 1. Bagian Jadwal tetap berhasil dirender
    expect(screen.getByText('Senin')).toBeDefined();
    expect(screen.getByText(/08:00/)).toBeDefined();
    expect(screen.getByText('Lab Komputer 3')).toBeDefined();

    // 2. Tab Tugas menampilkan error alert
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Timeout tugas')).toBeDefined();

    // 3. Pindah ke Tab Catatan
    const notesTabTrigger = screen.getByRole('tab', { name: /Catatan/i });
    fireEvent.click(notesTabTrigger);

    // Data catatan berhasil tampil tanpa alert error
    await screen.findByText('Catatan Pertemuan 1 - Pengenalan Big O');
    expect(screen.queryByRole('alert')).toBeNull();

    // 4. Pindah ke Tab Materi
    const materialsTabTrigger = screen.getByRole('tab', { name: /Materi/i });
    fireEvent.click(materialsTabTrigger);

    // Data materi berhasil tampil tanpa alert error
    const matElements = await screen.findAllByText('Slide Kuliah Bab 1.pdf');
    expect(matElements.length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('6. Kegagalan API jadwal perkuliahan menampilkan CourseTabErrorState dengan tombol Coba Lagi pada section jadwal', async () => {
    vi.mocked(listSchedules).mockRejectedValueOnce(new Error('Gagal memuat jadwal dari server'));

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // Alert pada section jadwal muncul
    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
    expect(screen.getByText('Gagal Memuat Jadwal Perkuliahan')).toBeDefined();
    expect(screen.getByText('Gagal memuat jadwal dari server')).toBeDefined();

    // Empty state jadwal tidak muncul
    expect(screen.queryByText('Belum ada jadwal perkuliahan')).toBeNull();

    // Tombol Coba Lagi memanggil re-fetch listSchedules
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(listSchedules).toHaveBeenCalledTimes(2);
    });
  });

  it('7. Kegagalan API catatan menampilkan error state pada tab Catatan', async () => {
    vi.mocked(listNotes).mockRejectedValueOnce(new Error('Database catatan error'));

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // Buka tab Catatan
    const notesTabTrigger = screen.getByRole('tab', { name: /Catatan/i });
    fireEvent.click(notesTabTrigger);

    // Alert error di tab catatan
    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
    expect(screen.getByText('Gagal Memuat Catatan Mata Kuliah')).toBeDefined();
    expect(screen.getByText('Database catatan error')).toBeDefined();

    // Empty state catatan tidak tampil
    expect(screen.queryByText('Belum ada catatan untuk mata kuliah ini')).toBeNull();
  });

  it('8. Kegagalan API materi menampilkan error state pada tab Materi', async () => {
    vi.mocked(listMaterials).mockRejectedValueOnce(new Error('Storage materi error'));

    render(<CourseDetailPage />);

    await screen.findByRole('heading', { name: 'Algoritma & Pemrograman' });

    // Buka tab Materi
    const materialsTabTrigger = screen.getByRole('tab', { name: /Materi/i });
    fireEvent.click(materialsTabTrigger);

    // Alert error di tab materi
    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
    expect(screen.getByText('Gagal Memuat Materi PDF')).toBeDefined();
    expect(screen.getByText('Storage materi error')).toBeDefined();

    // Empty state materi tidak tampil
    expect(screen.queryByText('Belum ada materi untuk mata kuliah ini')).toBeNull();
  });

  it('9. Memastikan cleanup pada unmount (isMountedRef) mencegah error callback/state update saat respons async tiba terlambat', async () => {
    let rejectDeferred!: (err: Error) => void;
    vi.mocked(listAssignments).mockImplementation(
      () =>
        new Promise<AssignmentListResponse>((_, reject) => {
          rejectDeferred = reject;
        })
    );

    const consoleErrorSpy = vi.spyOn(console, 'error');

    const { unmount } = render(<CourseDetailPage />);

    // listAssignments sedang in-flight
    expect(listAssignments).toHaveBeenCalledTimes(1);

    // Unmount komponen sebelum response tiba
    unmount();

    // Selesaikan promise dengan rejection setelah unmount
    await act(async () => {
      rejectDeferred(new Error('Koneksi terputus saat navigasi keluar'));
      await Promise.resolve();
    });

    // Guard if (!isMountedRef.current) return; mencegah pemanggilan console.error dan state setter
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Failed to load assignments:',
      expect.anything()
    );
  });
});
