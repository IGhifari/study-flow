'use client';

import * as React from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  Loader2,
} from 'lucide-react';
import { UserProfile } from '@studyflow/shared';
import {
  apiUpdateProfile,
  apiRequestEmailVerification,
} from '@/lib/auth-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export interface NotificationSettingsProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
}

export function NotificationSettings({ user, onUserUpdated }: NotificationSettingsProps): React.JSX.Element {
  const [reminderEmailDeadline, setReminderEmailDeadline] = React.useState(
    Boolean(user.reminderEmailDeadline)
  );
  const [isReminderSubmitting, setIsReminderSubmitting] = React.useState(false);
  const [reminderAlert, setReminderAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Email verification trigger state & cooldown
  const [isVerifyingSubmitting, setIsVerifyingSubmitting] = React.useState(false);
  const [verifyCooldown, setVerifyCooldown] = React.useState(0);

  React.useEffect(() => {
    setReminderEmailDeadline(Boolean(user.reminderEmailDeadline));
  }, [user.reminderEmailDeadline]);

  React.useEffect(() => {
    if (verifyCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerifyCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [verifyCooldown]);

  const handleSendVerificationEmail = async () => {
    setIsVerifyingSubmitting(true);
    setReminderAlert(null);
    try {
      const res = await apiRequestEmailVerification();
      setReminderAlert({ type: 'success', message: res.message });
      setVerifyCooldown(60); // 60s cooldown
    } catch (err: any) {
      setReminderAlert({
        type: 'error',
        message: err.message || 'Gagal mengirimkan email verifikasi. Silakan coba lagi.',
      });
    } finally {
      setIsVerifyingSubmitting(false);
    }
  };

  const handleToggleReminder = async (newVal: boolean) => {
    if (isReminderSubmitting) return;

    if (newVal && !user.emailVerifiedAt) {
      setReminderAlert({
        type: 'error',
        message: 'Alamat email harus diverifikasi terlebih dahulu sebelum mengaktifkan pengingat deadline.',
      });
      return;
    }

    setIsReminderSubmitting(true);
    setReminderAlert(null);

    try {
      const updated = await apiUpdateProfile({ reminderEmailDeadline: newVal });
      onUserUpdated(updated);
      setReminderEmailDeadline(Boolean(updated.reminderEmailDeadline));
      setReminderAlert({
        type: 'success',
        message: newVal
          ? 'Pengingat deadline via email berhasil diaktifkan. Anda akan menerima notifikasi sekitar 24 jam sebelum deadline tugas.'
          : 'Pengingat deadline via email berhasil dinonaktifkan.',
      });
    } catch (err: any) {
      setReminderAlert({
        type: 'error',
        message: err.message || 'Gagal mengubah preferensi pengingat deadline.',
      });
      setReminderEmailDeadline(Boolean(user.reminderEmailDeadline));
    } finally {
      setIsReminderSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <Bell className="h-4 w-4" />
          <span>Notifikasi & Pengingat</span>
        </div>
        <CardTitle className="text-lg">Pengingat Deadline Tugas</CardTitle>
        <CardDescription>
          Atur pengingat tenggat waktu tugas yang dikirimkan langsung ke kotak masuk email Anda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target Alamat Email */}
        <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Alamat Email Pengiriman</Label>
            {user.emailVerifiedAt ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> Terverifikasi
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs gap-1">
                <AlertCircle className="h-3 w-3" /> Belum Terverifikasi
              </Badge>
            )}
          </div>
          <Input
            value={user.email || ''}
            disabled
            readOnly
            className="bg-muted/50 cursor-not-allowed font-mono text-sm text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Pengingat dikirim ke alamat email resmi akun Anda.
          </p>
        </div>

        {/* Toggle Switch Pengingat H-1 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border p-4 bg-muted/20">
          <div className="space-y-1">
            <Label htmlFor="reminder-switch" className="text-sm font-medium text-foreground cursor-pointer">
              Pengingat deadline lewat email
            </Label>
            <p className="text-xs text-muted-foreground">
              Pengingat dikirim sekitar 24 jam sebelum deadline untuk tugas yang belum selesai.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            {isReminderSubmitting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch
              id="reminder-switch"
              checked={reminderEmailDeadline}
              onCheckedChange={handleToggleReminder}
              disabled={isReminderSubmitting || !user.emailVerifiedAt}
              aria-label="Pengingat deadline lewat email"
            />
          </div>
        </div>

        {/* Warning bila email belum terverifikasi */}
        {!user.emailVerifiedAt && (
          <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 text-xs py-3">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="space-y-2 flex-1">
              <AlertTitle className="text-xs font-semibold">Verifikasi Email Diperlukan</AlertTitle>
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                Hanya email yang telah diverifikasi yang dapat mengaktifkan pengingat deadline. Silakan verifikasi email Anda terlebih dahulu.
              </AlertDescription>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendVerificationEmail}
                  disabled={isVerifyingSubmitting || verifyCooldown > 0}
                  className="h-7 text-xs gap-1 border-amber-500/40 hover:bg-amber-100/50 dark:hover:bg-amber-900/40"
                >
                  {isVerifyingSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : verifyCooldown > 0 ? (
                    <>
                      <Clock className="h-3 w-3" />
                      <span className="tabular-nums">Kirim ulang ({verifyCooldown}s)</span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-3 w-3" />
                      <span>Kirim email verifikasi sekarang</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Feedback Alert */}
        {reminderAlert && (
          <Alert
            variant={reminderAlert.type === 'success' ? 'default' : 'destructive'}
            className={
              reminderAlert.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 py-2.5 text-xs'
                : 'py-2.5 text-xs'
            }
          >
            {reminderAlert.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{reminderAlert.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
