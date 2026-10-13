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

export interface VerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
  expiresInMinutes?: number;
}

export async function sendVerificationEmail(params: VerificationEmailParams): Promise<void> {
  const { to, name, verificationUrl, expiresInMinutes = 30 } = params;

  const subject = 'Verifikasi Alamat Email Akun StudyFlow';

  const plainText = [
    `Halo ${name || 'Pengguna StudyFlow'},`,
    '',
    'Terima kasih telah bergabung dengan StudyFlow. Silakan verifikasi alamat email Anda untuk memastikan keamanan akun Anda.',
    'Buka tautan berikut di peramban Anda untuk mengonfirmasi email Anda:',
    verificationUrl,
    '',
    `Tautan ini hanya berlaku selama ${expiresInMinutes} menit dan hanya dapat digunakan satu kali.`,
    'Jika Anda tidak merasa mendaftar atau meminta verifikasi email di StudyFlow, Anda dapat mengabaikan email ini.',
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
                Verifikasi Alamat Email
              </h1>
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #334155;">
                Halo <strong>${name || 'Pengguna'}</strong>, silakan verifikasi alamat email Anda untuk memastikan kepemilikan akun StudyFlow.
              </p>
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 14px; color: #334155;">
                Klik tombol di bawah ini untuk mengonfirmasi alamat email Anda:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Verifikasi Email Saya
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 12px; color: #64748b;">
                Tautan di atas berlaku selama <strong>${expiresInMinutes} menit</strong> dan hanya dapat digunakan 1 (satu) kali.
              </p>
              <p style="margin-top: 0; margin-bottom: 24px; font-size: 12px; color: #64748b;">
                Jika tombol di atas tidak berfungsi, salin dan tempel alamat berikut ke peramban Anda:<br>
                <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
              </p>
              <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0;">
                  Jika Anda tidak merasa mendaftar akun di StudyFlow, silakan abaikan email ini. Tidak ada perubahan yang akan dilakukan pada akun Anda.
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDeadlineInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
      timeZoneName: 'short',
    }).format(date);
  }
}

export interface AssignmentReminderEmailParams {
  to: string;
  name: string;
  assignmentTitle: string;
  courseName: string;
  dueDate: Date;
  timezone: string;
  assignmentId: string;
}

export async function sendAssignmentReminderEmail(params: AssignmentReminderEmailParams): Promise<void> {
  const { to, name, assignmentTitle, courseName, dueDate, timezone, assignmentId } = params;

  const formattedDeadline = formatDeadlineInTimezone(dueDate, timezone);
  const subject = `[Pengingat Deadline H-1] Tugas "${assignmentTitle}" jatuh tempo besok`;

  const assignmentUrl = `${env.APP_PUBLIC_URL}/assignments?id=${assignmentId}`;
  const settingsUrl = `${env.APP_PUBLIC_URL}/settings`;

  const safeTitle = escapeHtml(assignmentTitle);
  const safeCourse = escapeHtml(courseName);

  const plainText = [
    `Halo ${name || 'Pengguna StudyFlow'},`,
    '',
    `Ini adalah pengingat bahwa tugas Anda "${assignmentTitle}" pada mata kuliah "${courseName}" memiliki tenggat waktu besok.`,
    '',
    `Detail Tenggat Waktu: ${formattedDeadline} (Sekitar 24 jam lagi)`,
    '',
    `Buka tautan berikut untuk melihat detail atau menyelesaikan tugas Anda:`,
    assignmentUrl,
    '',
    `---`,
    `Anda menerima email ini karena mengaktifkan "Pengingat deadline lewat email" di akun StudyFlow Anda.`,
    `Untuk menonaktifkan pengingat ini kapan saja, silakan buka:`,
    settingsUrl,
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
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
              <span style="font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">StudyFlow</span>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h1 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
                Pengingat Deadline Tugas (H-1)
              </h1>
              <p style="margin-top: 0; margin-bottom: 16px; font-size: 14px; color: #334155;">
                Halo <strong>${escapeHtml(name || 'Pengguna')}</strong>, ini adalah pengingat bahwa Anda memiliki tugas yang akan jatuh tempo <strong>besok</strong> (sekitar 24 jam lagi).
              </p>
              
              <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                  ${safeTitle}
                </p>
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569;">
                  Mata Kuliah: <strong>${safeCourse}</strong>
                </p>
                <p style="margin: 0; font-size: 13px; color: #dc2626; font-weight: 600;">
                  Tenggat Waktu: ${formattedDeadline}
                </p>
              </div>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #2563eb;">
                    <a href="${assignmentUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Buka Detail Tugas
                    </a>
                  </td>
                </tr>
              </table>

              <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #64748b;">
                <p style="margin: 0 0 8px 0;">
                  Anda menerima email ini karena fitur <strong>Pengingat deadline lewat email</strong> diaktifkan di akun Anda.
                </p>
                <p style="margin: 0;">
                  Untuk menonaktifkan atau mengubah pengaturan notifikasi kapan saja, buka <a href="${settingsUrl}" style="color: #2563eb; text-decoration: underline;">Pengaturan Akun StudyFlow</a>.
                </p>
              </div>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" style="max-width: 540px; margin-top: 16px;" cellspacing="0" cellpadding="0">
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


