import { z } from 'zod';

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const TimezoneSchema = z.string().refine(isValidIanaTimezone, {
  message: 'Identifier zona waktu IANA tidak valid (contoh: Asia/Jakarta)',
});

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid'),
  password: z
    .string()
    .min(12, 'Password minimal 12 karakter (disarankan passphrase)')
    .max(128, 'Password maksimal 128 karakter'),
  timezone: TimezoneSchema.default('Asia/Jakarta'),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type RegisterFormInput = z.input<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UpdateProfileInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter').optional(),
  timezone: TimezoneSchema.optional(),
}).refine(data => data.name !== undefined || data.timezone !== undefined, {
  message: 'Minimal satu field (nama atau zona waktu) harus diisi',
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z
    .string()
    .min(12, 'Password baru minimal 12 karakter')
    .max(128, 'Password baru maksimal 128 karakter'),
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'Password baru harus berbeda dari password saat ini',
  path: ['newPassword'],
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  timezone: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const AuthResponseSchema = z.object({
  message: z.string(),
  user: UserProfileSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshTokenResponseSchema = z.object({
  message: z.string(),
  user: UserProfileSchema.optional(),
});
export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;

export const MessageResponseSchema = z.object({
  message: z.string(),
});
export type MessageResponse = z.infer<typeof MessageResponseSchema>;

export interface AccessTokenPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}
