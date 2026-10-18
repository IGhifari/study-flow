import * as React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { StudyFlowLogo } from '@/components/brand/studyflow-logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="Kembali ke halaman utama StudyFlow"
          >
            <StudyFlowLogo />
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Form Center */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        StudyFlow &copy; 2026. Platform Belajar Pribadi Mahasiswa.
      </footer>
    </div>
  );
}
