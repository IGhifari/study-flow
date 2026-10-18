// @vitest-environment happy-dom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { UserProfile } from '@studyflow/shared';
import SettingsPage from '@/app/(dashboard)/settings/page';
import { getCurrentUser, getGoogleAuthStatus } from '@/lib/auth-client';
import { getStorageUsage } from '@/lib/material-client';

// Mock auth-client
vi.mock('@/lib/auth-client', () => ({
  getCurrentUser: vi.fn(),
  getGoogleAuthStatus: vi.fn().mockResolvedValue(true),
  apiUpdateProfile: vi.fn(),
  apiRequestEmailVerification: vi.fn(),
  apiUpdateNotificationPreferences: vi.fn(),
  apiChangePassword: vi.fn(),
  unlinkGoogleAccount: vi.fn(),
}));

// Mock material-client
vi.mock('@/lib/material-client', () => ({
  getStorageUsage: vi.fn().mockResolvedValue({
    usedBytes: 2048000,
    maxBytes: 104857600,
    percentage: 2,
    filesCount: 3,
  }),
}));

// Mock motion to avoid animation RAF loops in happy-dom
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

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('Settings Page Error State & Lifecycle Behavioral Tests', () => {
  const mockUser: UserProfile = {
    id: 'user-001',
    name: 'Budi Santoso',
    email: 'budi.santoso@kampus.ac.id',
    role: 'USER',
    timezone: 'Asia/Jakarta',
    reminderEmailDeadline: true,
    hasPassword: true,
    providers: ['local'],
    emailVerifiedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('1. Menampilkan skeleton selama pemuatan data berlangsung (initial loading)', () => {
    // Pending promise: simulasi request in-flight
    vi.mocked(getCurrentUser).mockImplementation(() => new Promise(() => {}));

    render(<SettingsPage />);

    // Skeleton terpasang selama in-flight
    expect(screen.getByTestId('settings-skeleton')).toBeDefined();
    // Komponen alert error tidak boleh tampil saat masih loading
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('2. Menampilkan error state dan tombol Coba Lagi saat request gagal, bukan skeleton permanen', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Koneksi database server terputus'));

    render(<SettingsPage />);

    // Menunggu error state menggantikan skeleton
    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
    expect(screen.getByText('Gagal Memuat Pengaturan Akun')).toBeDefined();
    expect(screen.getByText('Koneksi database server terputus')).toBeDefined();

    // Tombol Coba Lagi tersedia bagi pengguna
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    expect(retryButton).toBeDefined();

    // Skeleton tidak boleh tetap tampil (terbebas dari stuck skeleton)
    expect(screen.queryByTestId('settings-skeleton')).toBeNull();
  });

  it('3. Tombol Coba Lagi memanggil ulang proses pemuatan pengguna', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Gagal pertama'));

    render(<SettingsPage />);

    await screen.findByRole('alert');
    expect(getCurrentUser).toHaveBeenCalledTimes(1);

    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalledTimes(2);
    });
  });

  it('4. Retry yang berhasil menampilkan halaman Settings lengkap dan membersihkan error state', async () => {
    // Panggilan pertama gagal, panggilan kedua (saat retry) berhasil
    vi.mocked(getCurrentUser)
      .mockRejectedValueOnce(new Error('Kegagalan sementara'))
      .mockResolvedValueOnce(mockUser);

    render(<SettingsPage />);

    // Tunggu state error muncul
    await screen.findByRole('alert');
    expect(screen.getByText('Kegagalan sementara')).toBeDefined();

    // Klik tombol Coba Lagi
    const retryButton = screen.getByRole('button', { name: /Coba Lagi/i });
    fireEvent.click(retryButton);

    // Verifikasi pemulihan halaman ke status sukses
    await screen.findByRole('heading', { level: 1, name: /Pengaturan Akun/i });
    await waitFor(() => {
      expect(screen.getByDisplayValue('Budi Santoso')).toBeDefined();
    });

    // Alert error dan skeleton sudah bersih dari layar
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('settings-skeleton')).toBeNull();
  });

  it('5. Memastikan cleanup pada unmount mencegah update state yang tidak semestinya', async () => {
    let resolveDeferred!: (value: UserProfile) => void;
    vi.mocked(getCurrentUser).mockImplementation(
      () =>
        new Promise<UserProfile>((resolve) => {
          resolveDeferred = resolve;
        })
    );

    const { unmount } = render(<SettingsPage />);

    // Memastikan getCurrentUser sudah dipanggil pada mount, tetapi getStorageUsage belum dipanggil
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(getStorageUsage).not.toHaveBeenCalled();

    // Unmount komponen sebelum promise diselesaikan
    unmount();

    // Selesaikan promise setelah komponen di-unmount dan beri kesempatan kelanjutan async berjalan
    await act(async () => {
      resolveDeferred(mockUser);
      await Promise.resolve();
    });

    // Guard if (!isMountedRef.current) return; harus mencegah eksekusi async lanjutan
    // Bukti konkret: getStorageUsage dan getGoogleAuthStatus tidak boleh dipanggil sama sekali
    expect(getStorageUsage).not.toHaveBeenCalled();
    expect(getGoogleAuthStatus).not.toHaveBeenCalled();
  });
});
