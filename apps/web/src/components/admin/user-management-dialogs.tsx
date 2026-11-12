'use client';

import * as React from 'react';
import { AlertCircle, Edit2, KeyRound, Loader2, Trash2 } from 'lucide-react';
import type { Role } from '@studyflow/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface EditUserFormState {
  name: string;
  email: string;
  role: Role;
  timezone: string;
  emailVerified: boolean;
}

export interface ManagedUserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: EditUserFormState;
  onFormChange: React.Dispatch<React.SetStateAction<EditUserFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
  isCurrentAdmin: boolean;
}

export function EditUserDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  isSubmitting,
  error,
  isCurrentAdmin,
}: EditUserDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary" />
            Edit Profil &amp; Peran
          </DialogTitle>
          <DialogDescription>
            Ubah rincian akun, hak akses peran, status verifikasi, serta zona waktu pengguna.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="text-xs font-semibold">
              Nama Lengkap
            </Label>
            <Input
              id="edit-name"
              required
              value={form.name}
              onChange={(e) => onFormChange((prev) => ({ ...prev, name: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-xs font-semibold">
              Alamat Email
            </Label>
            <Input
              id="edit-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => onFormChange((prev) => ({ ...prev, email: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Peran Akses</Label>
              <Select
                value={form.role}
                onValueChange={(val: Role) => onFormChange((prev) => ({ ...prev, role: val }))}
                disabled={isCurrentAdmin}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER" className="text-xs">
                    Mahasiswa (USER)
                  </SelectItem>
                  <SelectItem value="ADMIN" className="text-xs">
                    Administrator
                  </SelectItem>
                </SelectContent>
              </Select>
              {isCurrentAdmin && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Peran akun sendiri tidak dapat diturunkan.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Zona Waktu</Label>
              <Select
                value={form.timezone}
                onValueChange={(val: string) => onFormChange((prev) => ({ ...prev, timezone: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Jakarta" className="text-xs">
                    WIB (Asia/Jakarta)
                  </SelectItem>
                  <SelectItem value="Asia/Makassar" className="text-xs">
                    WITA (Asia/Makassar)
                  </SelectItem>
                  <SelectItem value="Asia/Jayapura" className="text-xs">
                    WIT (Asia/Jayapura)
                  </SelectItem>
                  <SelectItem value="UTC" className="text-xs">
                    UTC
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="edit-verified-checkbox"
              checked={form.emailVerified}
              onCheckedChange={(checked) =>
                onFormChange((prev) => ({ ...prev, emailVerified: Boolean(checked) }))
              }
            />
            <Label htmlFor="edit-verified-checkbox" className="text-xs cursor-pointer">
              Email terverifikasi
            </Label>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Simpan Perubahan</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ResetUserPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error: string | null;
}

export function ResetUserPasswordDialog({
  open,
  onOpenChange,
  newPassword,
  onNewPasswordChange,
  onSubmit,
  isSubmitting,
  error,
}: ResetUserPasswordDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset Kata Sandi Pengguna
          </DialogTitle>
          <DialogDescription>
            Masukkan kata sandi baru untuk pengguna ini. Seluruh sesi aktif pengguna akan otomatis dicabut.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-xs font-semibold">
              Kata Sandi Baru
            </Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={12}
              placeholder="Minimal 12 karakter..."
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onNewPasswordChange('');
              }}
              disabled={isSubmitting}
              className="h-9 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Reset Kata Sandi</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ManagedUserSummary | null;
  onConfirm: () => void;
  isSubmitting: boolean;
  error: string | null;
  isCurrentAdmin: boolean;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isSubmitting,
  error,
  isCurrentAdmin,
}: DeleteUserDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Hapus Akun Pengguna
          </DialogTitle>
          <DialogDescription>
            Tindakan ini bersifat permanen. Seluruh data akademik, materi, tugas, dan catatan milik pengguna akan dibersihkan secara kaskade.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="py-2 my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {user && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 my-2 text-xs space-y-1">
            <p>
              <strong className="text-foreground">Nama:</strong> {user.name}
            </p>
            <p>
              <strong className="text-foreground">Email:</strong> {user.email}
            </p>
            <p>
              <strong className="text-foreground">Peran:</strong> {user.role}
            </p>
          </div>
        )}

        <DialogFooter className="pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-9 text-xs"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting || isCurrentAdmin}
            className="h-9 text-xs gap-1.5"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Konfirmasi Hapus Akun</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
