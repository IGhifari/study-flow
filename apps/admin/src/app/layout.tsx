import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AdminAuthProvider } from '@/components/admin-auth-context';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'StudyFlow Admin — Panel Pengelola',
  description: 'Panel Administrator StudyFlow untuk mengelola platform, memantau metrik, dan daftar pengguna.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AdminAuthProvider>{children}</AdminAuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
