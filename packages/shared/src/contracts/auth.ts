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
  turnstileToken: z.string().optional(),
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
  turnstileToken: z.string().optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UpdateProfileInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter').optional(),
  timezone: TimezoneSchema.optional(),
  reminderEmailDeadline: z.boolean().optional(),
}).refine(data => data.name !== undefined || data.timezone !== undefined || data.reminderEmailDeadline !== undefined, {
  message: 'Minimal satu field (nama, zona waktu, atau preferensi pengingat) harus diisi',
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
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  emailVerifiedAt: z.string().datetime().nullable().default(null),
  reminderEmailDeadline: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  hasPassword: z.boolean().default(true),
  providers: z.array(z.string()).default([]),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const GoogleAuthStatusResponseSchema = z.object({
  configured: z.boolean(),
});
export type GoogleAuthStatusResponse = z.infer<typeof GoogleAuthStatusResponseSchema>;

export const GoogleExchangeInputSchema = z.object({
  code: z.string().min(1, 'Authorization code wajib diisi'),
  codeVerifier: z.string().min(1, 'Code verifier wajib diisi'),
  nonce: z.string().min(1, 'Nonce wajib diisi'),
  redirectUri: z.string().url('Redirect URI tidak valid'),
  intent: z.enum(['login', 'link']).default('login'),
});
export type GoogleExchangeInput = z.infer<typeof GoogleExchangeInputSchema>;

export const GoogleLinkInitInputSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi untuk re-autentikasi'),
});
export type GoogleLinkInitInput = z.infer<typeof GoogleLinkInitInputSchema>;

export const OAuthTransactionCookieSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  codeVerifier: z.string(),
  intent: z.enum(['login', 'link']),
  returnUrl: z.string().default('/dashboard'),
  userId: z.string().optional(),
  createdAt: z.number(),
});
export type OAuthTransactionCookie = z.infer<typeof OAuthTransactionCookieSchema>;

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
export const ForgotPasswordInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter'),
  turnstileToken: z.string().optional(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(32, 'Token reset password tidak valid'),
  newPassword: z
    .string()
    .min(12, 'Password baru minimal 12 karakter (disarankan passphrase)')
    .max(128, 'Password baru maksimal 128 karakter'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export const VerifyEmailInputSchema = z.object({
  token: z.string().min(32, 'Token verifikasi email tidak valid'),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailInputSchema>;

export const EmailVerificationStatusResponseSchema = z.object({
  isVerified: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable(),
});
export type EmailVerificationStatusResponse = z.infer<typeof EmailVerificationStatusResponseSchema>;

export interface AccessTokenPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

