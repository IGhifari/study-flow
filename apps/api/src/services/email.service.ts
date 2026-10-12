import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface SentEmailRecord {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  sentAt: Date;
}

// In-memory array for test inspection
const testSentEmails: SentEmailRecord[] = [];
let mockEmailFailure: Error | null = null;

export function __getSentTestEmails(): SentEmailRecord[] {
  return [...testSentEmails];
}

export function __clearSentTestEmails(): void {
  testSentEmails.length = 0;
  mockEmailFailure = null;
}

export function __setMockEmailFailure(err: Error | null): void {
  mockEmailFailure = err;
}

let smtpTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (env.EMAIL_DRIVER === 'mock' || env.NODE_ENV === 'test') {
    return null;
  }

  if (!env.SMTP_HOST) {
    throw new Error('SMTP host belum dikonfigurasi pada server aplikasi');
  }

  if (!smtpTransporter) {
    const isPort465 = env.SMTP_PORT === 465;
    const isSecure = env.SMTP_SECURE !== undefined ? env.SMTP_SECURE && isPort465 : isPort465;

    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: isSecure,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    });
  }

  return smtpTransporter;
}

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const { to, name, resetUrl, expiresInMinutes = 30 } = params;

  const subject = 'Atur Ulang Kata Sandi Akun StudyFlow';

  const plainText = [
    `Halo ${name || 'Pengguna StudyFlow'},`,
    '',
    'Kami menerima permintaan untuk mengatur ulang kata sandi akun StudyFlow Anda.',
    'Buka tautan berikut di peramban Anda untuk membuat kata sandi baru:',
    resetUrl,
    '',
    `Tautan ini hanya berlaku selama ${expiresInMinutes} menit dan hanya dapat digunakan satu kali.`,
    'Jika Anda tidak merasa meminta pengaturan ulang kata sandi, abaikan email ini. Akun Anda tetap aman.',
    '',
    'Salam hangat,',
    'Tim StudyFlow',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">StudyFlow</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h1 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
                Atur Ulang Kata Sandi
              </h1>
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #334155;">
                Halo <strong>${name || 'Pengguna'}</strong>, kami menerima permintaan untuk mengatur ulang kata sandi akun StudyFlow Anda.
              </p>
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #334155;">
                Silakan klik tombol di bawah ini untuk membuat kata sandi baru Anda:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Atur Ulang Kata Sandi
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 12px; color: #64748b;">
                Tautan di atas berlaku selama <strong>${expiresInMinutes} menit</strong> dan hanya dapat digunakan 1 (satu) kali.
              </p>
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 12px; color: #64748b;">
                Jika tombol di atas tidak berfungsi, salin dan tempel alamat berikut ke peramban Anda:<br>
                <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
              </p>
              <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0;">
                  Jika Anda tidak meminta pengaturan ulang kata sandi ini, silakan abaikan email ini. Akun StudyFlow Anda tetap aman dan tidak ada perubahan yang dilakukan.
                </p>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" style="max-width: 520px; margin-top: 16px;" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="font-size: 12px; color: #94a3b8;">
              &copy; ${new Date().getFullYear()} StudyFlow. Hak cipta dilindungi undang-undang.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // 1. Mock Transport Mode (for automated tests and explicit mock driver)
  if (env.EMAIL_DRIVER === 'mock' || env.NODE_ENV === 'test') {
    if (mockEmailFailure) {
      throw mockEmailFailure;
    }
    testSentEmails.push({
      to,
      from: env.SMTP_FROM,
      subject,
      text: plainText,
      html,
      sentAt: new Date(),
    });
    return;
  }

  // 2. Real SMTP Transport Mode
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Transporter SMTP tidak tersedia');
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text: plainText,
    html,
  });
}
