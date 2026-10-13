import { Metadata } from 'next';
import VerifyEmailClient from './verify-email-client';

export const metadata: Metadata = {
  title: 'Verifikasi Email — StudyFlow',
  description: 'Konfirmasi alamat email akun StudyFlow Anda',
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
