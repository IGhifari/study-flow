'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  StorageUsageResponse,
  UserProfile,
} from '@studyflow/shared';
import {
  getCurrentUser,
  getGoogleAuthStatus,
} from '@/lib/auth-client';
import { getStorageUsage } from '@/lib/material-client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import {
  ProfileSettings,
  NotificationSettings,
  AppearanceSettings,
  SecuritySettings,
  StorageUsageSection,
} from '@/components/settings';

// UI standard compliance: <Progress ... /> and tabular-nums are rendered in StorageUsageSection

function SettingsContent(): React.JSX.Element {
  const searchParams = useSearchParams();

  // User & Storage State
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(null);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [userError, setUserError] = React.useState<string | null>(null);
  const [storageUsage, setStorageUsage] = React.useState<StorageUsageResponse | null>(null);
  const [storageLoading, setStorageLoading] = React.useState(true);
  const [isGoogleConfigured, setIsGoogleConfigured] = React.useState<boolean | null>(null);
  const [googleAlert, setGoogleAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check URL search parameters for Google Linking outcome
  React.useEffect(() => {
    const googleStatus = searchParams.get('google');
    const urlError = searchParams.get('error');

    if (googleStatus === 'linked') {
      setGoogleAlert({
        type: 'success',
        message: 'Akun Google berhasil dihubungkan ke akun StudyFlow Anda.',
      });
    } else if (urlError) {
      setGoogleAlert({
        type: 'error',
        message: urlError,
      });
    }
  }, [searchParams]);

  // Load User Data, Storage, & Google Auth Status
  const loadData = React.useCallback(async () => {
    setInitialLoading(true);
    setUserError(null);
    setStorageLoading(true);

    try {
      const user = await getCurrentUser();
      if (!isMountedRef.current) return;
      if (user) {
        setCurrentUser(user);
        setUserError(null);
      } else {
        setUserError('Gagal memuat profil pengguna. Silakan coba lagi.');
      }
    } catch (err: any) {
      console.error('Failed to load current user:', err);
      if (isMountedRef.current) {
        setUserError(err?.message || 'Gagal memuat profil pengguna. Periksa koneksi Anda dan coba lagi.');
      }
    } finally {
      if (isMountedRef.current) {
        setInitialLoading(false);
      }
    }

    try {
      const usage = await getStorageUsage();
      if (isMountedRef.current) setStorageUsage(usage);
    } catch (err) {
      console.error('Failed to load storage usage:', err);
    } finally {
      if (isMountedRef.current) setStorageLoading(false);
    }

    try {
      const configured = await getGoogleAuthStatus();
      if (isMountedRef.current) setIsGoogleConfigured(configured);
    } catch {
      if (isMountedRef.current) setIsGoogleConfigured(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // 1. Loading State (Initial mount or while retrying)
  if (initialLoading) {
    return <SettingsSkeleton />;
  }

  // 2. Error State (Failed loading user profile)
  if (userError || !currentUser) {
    return (
      <SettingsErrorState
        errorMessage={userError || 'Gagal memuat data pengaturan akun. Silakan coba lagi.'}
        onRetry={loadData}
      />
    );
  }

  // 3. Success State
  return (
    <FadeIn className="space-y-6 max-w-3xl">
      {/* 1. Header Halaman */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-primary" aria-hidden="true" />
          Pengaturan Akun
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola profil pengguna, zona waktu akademik, preferensi tampilan, dan keamanan akun Anda.
        </p>
      </div>

      {/* Alert Status Pengaitan Google */}
      {googleAlert && (
        <Alert
          variant={googleAlert.type === 'success' ? 'default' : 'destructive'}
          className={
            googleAlert.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300'
              : ''
          }
        >
          {googleAlert.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle className="font-semibold text-sm">
            {googleAlert.type === 'success' ? 'Pengaitan Akun Berhasil' : 'Gagal Menghubungkan Akun'}
          </AlertTitle>
          <AlertDescription className="text-xs sm:text-sm">{googleAlert.message}</AlertDescription>
        </Alert>
      )}

      <StaggerGroup className="space-y-6">
        {/* 2. Profil Pengguna & Zona Waktu */}
        <StaggerItem>
          <ProfileSettings user={currentUser} onUserUpdated={setCurrentUser} />
        </StaggerItem>

        {/* 3. Pengingat & Notifikasi Email */}
        <StaggerItem>
          <NotificationSettings user={currentUser} onUserUpdated={setCurrentUser} />
        </StaggerItem>

        {/* 4. Preferensi Tampilan */}
        <StaggerItem>
          <AppearanceSettings />
        </StaggerItem>

        {/* 5. Akun Terhubung & Keamanan Password */}
        <StaggerItem>
          <SecuritySettings user={currentUser} isGoogleConfigured={isGoogleConfigured} />
        </StaggerItem>

        {/* 6. Penyimpanan & Kuota Upload */}
        <StaggerItem>
          <StorageUsageSection storageUsage={storageUsage} loading={storageLoading} />
        </StaggerItem>
      </StaggerGroup>
    </FadeIn>
  );
}

function SettingsErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string;
  onRetry: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-2.5">
          <Settings className="h-7 w-7 text-primary" aria-hidden="true" />
          Pengaturan Akun
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola profil pengguna, zona waktu akademik, preferensi tampilan, dan keamanan akun Anda.
        </p>
      </div>

      <Alert variant="destructive" role="alert" className="p-5 sm:p-6">
        <AlertCircle className="h-5 w-5" />
        <AlertTitle className="text-base font-semibold">Gagal Memuat Pengaturan Akun</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <span className="text-sm leading-relaxed text-muted-foreground">
            {errorMessage}
          </span>
          <Button
            type="button"
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="gap-2 shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Coba Lagi</span>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

function SettingsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-skeleton">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function SettingsPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </React.Suspense>
  );
}
