import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'StudyFlow — Ruang Belajar Pribadi Mahasiswa',
  description:
    'Platform belajar pribadi untuk mahasiswa: kelola semester, mata kuliah, tugas, catatan, dan materi PDF dengan bantuan ringkasan, flashcard, dan kuis AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${geistSans.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
