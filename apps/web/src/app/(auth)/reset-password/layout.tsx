import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Kata Sandi - StudyFlow',
  description: 'Atur ulang kata sandi akun StudyFlow Anda',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
