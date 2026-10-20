// @vitest-environment happy-dom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type {
  MaterialListItem,
  Course,
  Semester,
  UserProfile,
  MaterialListResponse,
} from '@studyflow/shared';
import MaterialsPage from '@/app/(dashboard)/materials/page';
import { listMaterials, deleteMaterial, retryMaterialProcessing, getMaterialDownloadUrl } from '@/lib/material-client';
import { listCourses } from '@/lib/course-client';
import { listSemesters } from '@/lib/semester-client';
import { getProfile } from '@/lib/auth-client';
import { pinMaterial } from '@/lib/pin-client';

// Mock dependencies
vi.mock('@/lib/material-client', () => ({
  listMaterials: vi.fn(),
  deleteMaterial: vi.fn(),
  retryMaterialProcessing: vi.fn(),
  getMaterialDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/course-client', () => ({
  listCourses: vi.fn(),
}));

vi.mock('@/lib/semester-client', () => ({
  listSemesters: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  getProfile: vi.fn(),
}));

vi.mock('@/lib/pin-client', () => ({
  pinMaterial: vi.fn(),
}));

vi.mock('@/components/ui/motion', () => ({
  FadeIn: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerGroup: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  StaggerItem: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/materials/material-upload-dialog', () => ({
  MaterialUploadDialog: () => <div data-testid="upload-dialog-mock" />,
}));

describe('MaterialsPage - Search Optimization, Debounce & Race Condition Behavioral Tests', () => {
  const mockProfile: UserProfile = {
    id: 'user-1',
    name: 'Siswa Belajar',
    email: 'siswa@example.com',
    role: 'USER',
    timezone: 'Asia/Jakarta',
    reminderEmailDeadline: true,
    hasPassword: true,
    providers: ['local'],
    emailVerifiedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const mockCourses: Course[] = [
    {
      id: 'course-101',
      code: 'CS101',
      name: 'Algoritma & Pemrograman',
      lecturer: 'Dr. John',
      description: 'Dasar algoritma',
      semesterId: 'sem-1',
      userId: 'user-1',
      archivedAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'course-102',
      code: 'CS102',
      name: 'Basis Data',
      lecturer: 'Dr. Jane',
      description: 'Sistem basis data',
      semesterId: 'sem-1',
      userId: 'user-1',
      archivedAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const mockActiveSemester: Semester = {
    id: 'sem-1',
    name: 'Semester Ganjil',
    academicYear: '2026/2027',
    userId: 'user-1',
    isActive: true,
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const createMaterial = (id: string, title: string, courseId = 'course-101'): MaterialListItem => ({
    id,
    title,
    originalFilename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
    bytes: 1048576,
    mimeType: 'application/pdf',
    pageCount: 10,
    courseId,
    course: mockCourses.find((c) => c.id === courseId),
    status: 'READY',
    userId: 'user-1',
    isPinned: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  });

  const emptyResponse: MaterialListResponse = {
    materials: [],
    pagination: { total: 0, page: 1, limit: 20, totalPages: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(getProfile).mockResolvedValue(mockProfile);
    vi.mocked(listCourses).mockResolvedValue({ courses: mockCourses });
    vi.mocked(listSemesters).mockResolvedValue({
      semesters: [mockActiveSemester],
      activeSemester: mockActiveSemester,
      activeSemesterId: mockActiveSemester.id,
    });
    vi.mocked(listMaterials).mockResolvedValue(emptyResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Pencarian menunggu debounce (~300ms) sebelum memicu request API listMaterials', async () => {
    vi.useFakeTimers();

    render(<MaterialsPage />);

    // Initial mount memicu listMaterials satu kali (query kosong)
    expect(listMaterials).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText('Cari judul materi...');

    // User mengetik "algoritma"
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'algoritma' } });
    });

    // Pada 150ms (sebelum 300ms), listMaterials BELUM dipanggil ulang
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(listMaterials).toHaveBeenCalledTimes(1);

    // Pada 300ms, debounce timer selesai dan memicu pencarian baru
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(listMaterials).toHaveBeenCalledTimes(2);
    expect(listMaterials).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'algoritma',
        page: 1,
      }),
      expect.anything()
    );
  });

  it('2. Beberapa ketikan cepat hanya menghasilkan satu pencarian berdasarkan query terakhir', async () => {
    vi.useFakeTimers();

    render(<MaterialsPage />);
    expect(listMaterials).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText('Cari judul materi...');

    // Simulasi ketikan beruntun dengan interval 80ms
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'a' } });
      vi.advanceTimersByTime(80);
      fireEvent.change(searchInput, { target: { value: 'al' } });
      vi.advanceTimersByTime(80);
      fireEvent.change(searchInput, { target: { value: 'algo' } });
      vi.advanceTimersByTime(80);
      fireEvent.change(searchInput, { target: { value: 'algoritma' } });
    });

    // Masih belum ada request baru sebelum 300ms setelah ketikan terakhir
    expect(listMaterials).toHaveBeenCalledTimes(1);

    // Majukan 300ms setelah ketikan terakhir
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Hanya 1 request baru yang dipanggil dengan query terakhir ('algoritma')
    expect(listMaterials).toHaveBeenCalledTimes(2);
    expect(listMaterials).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'algoritma',
      }),
      expect.anything()
    );
  });

  it('3. Respons request lama yang datang terlambat tidak menimpa hasil pencarian terbaru (Race Condition Protection)', async () => {
    let resolveQueryLama!: (res: MaterialListResponse) => void;
    let resolveQueryBaru!: (res: MaterialListResponse) => void;

    const promiseLama = new Promise<MaterialListResponse>((resolve) => {
      resolveQueryLama = resolve;
    });
    const promiseBaru = new Promise<MaterialListResponse>((resolve) => {
      resolveQueryBaru = resolve;
    });

    // Mount awal
    vi.mocked(listMaterials)
      .mockResolvedValueOnce(emptyResponse) // Mount
      .mockImplementationOnce(() => promiseLama) // Request 1: query "lama"
      .mockImplementationOnce(() => promiseBaru); // Request 2: query "baru"

    render(<MaterialsPage />);

    const searchInput = screen.getByPlaceholderText('Cari judul materi...');

    // Trigger Request 1 (Query "lama")
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'lama' } });
      await new Promise((r) => setTimeout(r, 350));
    });

    // Trigger Request 2 (Query "baru") sebelum Request 1 selesai
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'baru' } });
      await new Promise((r) => setTimeout(r, 350));
    });

    const materialBaru = createMaterial('mat-baru', 'Materi Baru Terkini');
    const materialLama = createMaterial('mat-lama', 'Materi Lama Kedaluwarsa');

    // Selesaikan Request 2 TERLEBIH DAHULU
    await act(async () => {
      resolveQueryBaru({
        materials: [materialBaru],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      await Promise.resolve();
    });

    // UI harus menampilkan materi dari query baru
    const itemsBaru = await screen.findAllByText('Materi Baru Terkini');
    expect(itemsBaru.length).toBeGreaterThan(0);

    // Selesaikan Request 1 TERLAMBAT (out-of-order response)
    await act(async () => {
      resolveQueryLama({
        materials: [materialLama],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      await Promise.resolve();
    });

    // UI HARUS TETAP menampilkan materi baru dan TIDAK menimpa dengan materi lama
    expect(screen.queryByText('Materi Lama Kedaluwarsa')).toBeNull();
    const itemsBaruTetap = await screen.findAllByText('Materi Baru Terkini');
    expect(itemsBaruTetap.length).toBeGreaterThan(0);
  });

  it('4. Perubahan filter mata kuliah dan status langsung memicu request data yang sesuai', async () => {
    vi.mocked(listMaterials).mockResolvedValue(emptyResponse);

    render(<MaterialsPage />);
    expect(listMaterials).toHaveBeenCalledTimes(1);

    // Select Course Filter (combobox)
    const comboboxes = screen.getAllByRole('combobox');
    const courseSelectTrigger = comboboxes[0];

    // Klik dropdown course dan pilih CS101
    fireEvent.click(courseSelectTrigger);
    const courseOption = await screen.findByRole('option', { name: 'Algoritma & Pemrograman' });
    fireEvent.click(courseOption);

    await waitFor(() => {
      expect(listMaterials).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'course-101',
          page: 1,
        }),
        expect.anything()
      );
    });

    // Select Status Filter
    const statusSelectTrigger = comboboxes[1];
    fireEvent.click(statusSelectTrigger);
    const statusOption = await screen.findByRole('option', { name: 'Siap dipelajari' });
    fireEvent.click(statusOption);

    await waitFor(() => {
      expect(listMaterials).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'course-101',
          status: 'READY',
          page: 1,
        }),
        expect.anything()
      );
    });
  });

  it('5. Pagination direset ke halaman 1 ketika kata kunci pencarian atau filter berubah', async () => {
    const multiPageResponse: MaterialListResponse = {
      materials: [createMaterial('m-1', 'Halaman 1 Materi')],
      pagination: { total: 40, page: 1, limit: 20, totalPages: 2 },
    };

    const page2Response: MaterialListResponse = {
      materials: [createMaterial('m-2', 'Halaman 2 Materi')],
      pagination: { total: 40, page: 2, limit: 20, totalPages: 2 },
    };

    vi.mocked(listMaterials)
      .mockResolvedValueOnce(multiPageResponse)
      .mockResolvedValueOnce(page2Response)
      .mockResolvedValue(emptyResponse);

    render(<MaterialsPage />);

    // Tunggu tombol pagination muncul
    const nextBtn = await screen.findByRole('button', { name: /Halaman berikutnya/i });
    expect(nextBtn).toBeDefined();

    // User berpindah ke halaman 2
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(listMaterials).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        }),
        expect.anything()
      );
    });

    // Ketika pengguna mengetik query pencarian baru
    const searchInput = screen.getByPlaceholderText('Cari judul materi...');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'struktur' } });
      await new Promise((r) => setTimeout(r, 350));
    });

    // Request yang dipicu HARUS kembali ke page: 1
    expect(listMaterials).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'struktur',
        page: 1,
      }),
      expect.anything()
    );
  });

  it('6. Metadata (profil, daftar course, dan semester) TIDAK dimuat ulang pada setiap ketikan pencarian', async () => {
    render(<MaterialsPage />);

    // Initial mount memanggil metadata masing-masing 1 kali
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(listCourses).toHaveBeenCalledTimes(1);
    expect(listSemesters).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText('Cari judul materi...');

    // Simulasi pengguna mengetik berkali-kali
    for (const text of ['p', 'pr', 'pro', 'prog', 'program']) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: text } });
        await new Promise((r) => setTimeout(r, 50));
      });
    }

    // Tunggu debounce selesai
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });

    // listMaterials terpanggil untuk query terakhir
    expect(listMaterials).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'program',
      }),
      expect.anything()
    );

    // Kritis: Metadata TETAP HANYA DIPANGGIL 1 KALI (efisien, tidak ada request berlebihan)
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(listCourses).toHaveBeenCalledTimes(1);
    expect(listSemesters).toHaveBeenCalledTimes(1);
  });

  it('7. Cleanup timer dan request pembatalan bekerja saat komponen unmount', async () => {
    let rejectDeferred!: (err: Error) => void;
    vi.mocked(listMaterials)
      .mockResolvedValueOnce(emptyResponse)
      .mockImplementationOnce(
        () =>
          new Promise<MaterialListResponse>((_, reject) => {
            rejectDeferred = reject;
          })
      );

    const consoleErrorSpy = vi.spyOn(console, 'error');

    const { unmount } = render(<MaterialsPage />);

    const searchInput = screen.getByPlaceholderText('Cari judul materi...');

    // Trigger request yang akan tertunda
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'cleanup-test' } });
      await new Promise((r) => setTimeout(r, 350));
    });

    // Unmount komponen saat request masih berjalan
    unmount();

    // Selesaikan promise dengan rejection setelah unmount
    await act(async () => {
      rejectDeferred(new Error('Koneksi terputus saat navigasi keluar'));
      await Promise.resolve();
    });

    // isMountedRef guard harus mencegah logging error atau state update pada unmounted component
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Failed to load materials:',
      expect.anything()
    );
  });

  it('8. Kegagalan request lama tidak merusak UI ketika request terbaru berhasil', async () => {
    let rejectLama!: (err: Error) => void;
    let resolveBaru!: (res: MaterialListResponse) => void;

    const promiseLama = new Promise<MaterialListResponse>((_, reject) => {
      rejectLama = reject;
    });
    const promiseBaru = new Promise<MaterialListResponse>((resolve) => {
      resolveBaru = resolve;
    });

    vi.mocked(listMaterials)
      .mockResolvedValueOnce(emptyResponse) // Mount
      .mockImplementationOnce(() => promiseLama) // Request 1: gagal lambat
      .mockImplementationOnce(() => promiseBaru); // Request 2: sukses cepat

    render(<MaterialsPage />);

    const searchInput = screen.getByPlaceholderText('Cari judul materi...');

    // Trigger Request 1
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'request-1' } });
      await new Promise((r) => setTimeout(r, 350));
    });

    // Trigger Request 2
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'request-2' } });
      await new Promise((r) => setTimeout(r, 350));
    });

    const materialBaru = createMaterial('mat-2', 'Hasil Pencarian Sukses Request 2');

    // Selesaikan Request 2 dengan sukses
    await act(async () => {
      resolveBaru({
        materials: [materialBaru],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      await Promise.resolve();
    });

    // Data sukses tampil di layar
    const items = await screen.findAllByText('Hasil Pencarian Sukses Request 2');
    expect(items.length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();

    // Sekarang reject Request 1 yang sudah kedaluwarsa
    await act(async () => {
      rejectLama(new Error('Error lama dari request 1'));
      await Promise.resolve();
    });

    // Error lama TIDAK BOLEH menggantikan data sukses atau menampilkan alert error!
    expect(screen.queryByRole('alert')).toBeNull();
    const itemsTetap = await screen.findAllByText('Hasil Pencarian Sukses Request 2');
    expect(itemsTetap.length).toBeGreaterThan(0);
  });
});
