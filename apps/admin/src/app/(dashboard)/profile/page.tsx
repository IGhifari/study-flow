'use client';

import * as React from 'react';
import {
  UserCog,
  Shield,
  KeyRound,
  Laptop,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Calendar,
  Mail,
  Loader2,
  RefreshCw,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FadeIn } from '@/components/ui/motion';
import { useAdminAuth } from '@/components/admin-auth-context';
import {
  updateAdminProfileApi,
  changeAdminPasswordApi,
  fetchAdminSessionsApi,
  revokeAdminSessionApi,
} from '@/lib/admin-api';
import type { AdminSessionItem } from '@studyflow/shared';
import {
  AdminUpdateProfileInputSchema,
  AdminChangePasswordFormSchema,
} from '@studyflow/shared';
import { formatLocalDateTime } from '@/lib/admin-formatters';
import { toast } from 'sonner';

export default function AdminProfilePage() {
  const { user, refreshUser } = useAdminAuth();

  // Profile Form State
  const [profileName, setProfileName] = React.useState(user?.name || '');
  const [profileTimezone, setProfileTimezone] = React.useState(user?.timezone || 'Asia/Jakarta');
  const [isUpdatingProfile, setIsUpdatingProfile] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  // Sync initial user state
  React.useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileTimezone(user.timezone || 'Asia/Jakarta');
    }
  }, [user]);

  // Change Password State
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  // Active Sessions State
  const [sessions, setSessions] = React.useState<AdminSessionItem[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = React.useState(true);
  const [sessionsError, setSessionsError] = React.useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = React.useState<string | null>(null);

  const loadSessions = React.useCallback(async (signal?: AbortSignal) => {
    setIsSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetchAdminSessionsApi({ signal });
      setSessions(res.sessions);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setSessionsError(err.message || 'Gagal memuat sesi aktif administrator');
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    loadSessions(controller.signal);
    return () => controller.abort();
  }, [loadSessions]);

  // Handle Profile Update
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const validationResult = AdminUpdateProfileInputSchema.safeParse({
      name: profileName,
      timezone: profileTimezone,
    });

    if (!validationResult.success) {
      setProfileError(validationResult.error.errors[0]?.message || 'Input profil administrator tidak valid');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateAdminProfileApi(validationResult.data);
      await refreshUser();
      toast.success('Profil administrator berhasil diperbarui');
    } catch (err: any) {
      setProfileError(err.message || 'Gagal memperbarui profil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Change Password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    const validationResult = AdminChangePasswordFormSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validationResult.success) {
      setPasswordError(validationResult.error.errors[0]?.message || 'Input kata sandi tidak valid');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeAdminPasswordApi({
        currentPassword: validationResult.data.currentPassword,
        newPassword: validationResult.data.newPassword,
      });
      toast.success('Kata sandi administrator berhasil diperbarui tanpa memutus sesi aktif Anda');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadSessions();
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal memperbarui kata sandi');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Revoke Session
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await revokeAdminSessionApi(sessionId);
      toast.success('Sesi login berhasil dicabut');
      loadSessions();
    } catch (err: any) {
      toast.error('Gagal mencabut sesi login: ' + err.message);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <FadeIn className="flex flex-1 flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Cockpit Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl flex items-center gap-2">
          <UserCog className="h-7 w-7 text-primary" />
          Profil &amp; Keamanan Administrator
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola profil pengelola sistem, preferensi zona waktu, perbarui kredensial kata sandi, dan awasi sesi aktif.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identity Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="text-center pb-2">
              <Avatar className="h-20 w-20 mx-auto rounded-xl ring-2 ring-primary/20">
                <AvatarFallback className="text-xl font-bold rounded-xl bg-primary/10 text-primary">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-lg font-bold text-foreground mt-3">
                {user?.name || 'Administrator'}
              </CardTitle>
              <CardDescription className="font-mono text-xs text-muted-foreground">
                {user?.email || 'admin@studyflow.id'}
              </CardDescription>
              <div className="pt-2 flex justify-center">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-semibold gap-1 text-xs">
                  <Shield className="h-3 w-3" />
                  Administrator Sistem
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Zona Waktu
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {user?.timezone || 'Asia/Jakarta'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Status Email
                  </span>
                  {user?.emailVerifiedAt ? (
                    <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs">
                      Terverifikasi
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-warning text-warning-foreground border-transparent text-xs">
                      Belum Verifikasi
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Bergabung
                  </span>
                  <span className="text-foreground tabular-nums">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground block mb-1">
                  Kewenangan Administratif:
                </span>
                Akun ini memiliki hak akses penuh untuk memoderasi berkas materi, memantau antrean pemrosesan AI, dan mengelola direktori pengguna.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions (Profile, Password, Sessions) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Edit Profile */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Informasi Profil &amp; Preferensi
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Perbarui nama tampilan administrator dan preferensi zona waktu operasional.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleProfileSubmit}>
              <CardContent className="space-y-4">
                {profileError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{profileError}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-name" className="text-xs font-semibold">Nama Administrator</Label>
                    <Input
                      id="admin-name"
                      required
                      minLength={2}
                      maxLength={100}
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="admin-timezone" className="text-xs font-semibold">Zona Waktu</Label>
                    <Select
                      value={profileTimezone}
                      onValueChange={setProfileTimezone}
                    >
                      <SelectTrigger id="admin-timezone" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Jakarta" className="text-xs">WIB (Asia/Jakarta - UTC+7)</SelectItem>
                        <SelectItem value="Asia/Makassar" className="text-xs">WITA (Asia/Makassar - UTC+8)</SelectItem>
                        <SelectItem value="Asia/Jayapura" className="text-xs">WIT (Asia/Jayapura - UTC+9)</SelectItem>
                        <SelectItem value="UTC" className="text-xs">UTC (Coordinated Universal Time)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-email" className="text-xs font-semibold text-muted-foreground">Alamat Email (Akun Utama)</Label>
                  <Input
                    id="admin-email"
                    disabled
                    value={user?.email || ''}
                    className="h-9 text-xs font-mono bg-muted/40 cursor-not-allowed opacity-80"
                  />
                  <p className="text-xs text-muted-foreground">
                    Perubahan alamat email administrator dikunci untuk menjaga integritas kredensial akses.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border pt-3 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdatingProfile}
                  className="gap-1.5 h-9 text-xs"
                >
                  {isUpdatingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Simpan Perubahan Profil</span>
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Section 2: Change Password */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Ganti Kata Sandi Administrator
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Perbarui kata sandi akun Anda. Sesi aktif yang sedang Anda gunakan akan otomatis diperpanjang tanpa logout.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                {passwordError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{passwordError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="current-pw" className="text-xs font-semibold">Kata Sandi Saat Ini</Label>
                  <div className="relative">
                    <Input
                      id="current-pw"
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      placeholder="Masukkan kata sandi saat ini..."
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-9 text-xs pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pw" className="text-xs font-semibold">Kata Sandi Baru</Label>
                    <div className="relative">
                      <Input
                        id="new-pw"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        placeholder="Minimal 8 karakter..."
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-9 text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pw" className="text-xs font-semibold">Konfirmasi Kata Sandi Baru</Label>
                    <div className="relative">
                      <Input
                        id="confirm-pw"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        placeholder="Ulangi kata sandi baru..."
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-9 text-xs pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border pt-3 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="gap-1.5 h-9 text-xs"
                >
                  {isChangingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Perbarui Kata Sandi</span>
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Section 3: Active Sessions */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Laptop className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Sesi Login &amp; Perangkat Aktif
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadSessions()}
                  disabled={isSessionsLoading}
                  className="h-7 text-xs gap-1.5 self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3 w-3 ${isSessionsLoading ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </Button>
              </div>
              <CardDescription className="text-xs">
                Daftar refresh session aktif yang sedang terautentikasi ke Portal Administrator.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {sessionsError && (
                <Alert variant="destructive" className="py-2 mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{sessionsError}</AlertDescription>
                </Alert>
              )}

              {isSessionsLoading && sessions.length === 0 ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Tidak ada data sesi aktif ditemukan.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-xs h-9">ID Sesi / Family</TableHead>
                        <TableHead className="text-xs h-9">Waktu Login</TableHead>
                        <TableHead className="text-xs h-9">Masa Berlaku</TableHead>
                        <TableHead className="text-xs h-9">Status</TableHead>
                        <TableHead className="text-xs h-9 text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((sess) => (
                        <TableRow key={sess.id} className="hover:bg-muted/30">
                          <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">
                            {sess.familyId.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="py-2.5 text-xs tabular-nums text-foreground">
                            {formatLocalDateTime(sess.createdAt, true)}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs tabular-nums text-muted-foreground">
                            {formatLocalDateTime(sess.expiresAt, true)}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {sess.isCurrent ? (
                              <Badge variant="outline" className="bg-success text-success-foreground border-transparent text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Sesi Ini</span>
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Perangkat Lain
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            {sess.isCurrent ? (
                              <span className="text-xs text-muted-foreground italic mr-2">Sedang Aktif</span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeSession(sess.id)}
                                disabled={revokingSessionId === sess.id}
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                              >
                                {revokingSessionId === sess.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <LogOut className="h-3 w-3" />
                                )}
                                <span>Cabut</span>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </FadeIn>
  );
}
