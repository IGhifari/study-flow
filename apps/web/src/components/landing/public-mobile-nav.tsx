'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, BookOpen, ArrowRight, Layers, HelpCircle, CalendarRange } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export interface PublicMobileNavProps {
  user?: { name?: string | null; email?: string } | null;
}

export function PublicMobileNav({ user }: PublicMobileNavProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const handleLinkClick = () => {
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-9 w-9 md:hidden relative after:absolute after:-inset-2 sm:after:hidden touch-manipulation text-muted-foreground hover:text-foreground"
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[300px] sm:w-[340px] flex flex-col justify-between bg-card text-foreground p-5 border-l border-border"
      >
        <div className="space-y-6">
          <SheetHeader className="text-left space-y-1.5 pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </div>
              <SheetTitle className="text-lg font-bold tracking-tight text-foreground">
                StudyFlow
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Ruang belajar pribadi mahasiswa
            </SheetDescription>
          </SheetHeader>

          {/* Navigasi Seksi */}
          <nav className="flex flex-col space-y-1" aria-label="Navigasi menu ponsel">
            <Link
              href="#fitur"
              onClick={handleLinkClick}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              <CalendarRange className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>Fitur Unggulan</span>
            </Link>

            <Link
              href="#cara-kerja"
              onClick={handleLinkClick}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              <Layers className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>Cara Kerja</span>
            </Link>

            <Link
              href="#faq"
              onClick={handleLinkClick}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
            >
              <HelpCircle className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>Tanya Jawab (FAQ)</span>
            </Link>
          </nav>

          {/* Pengaturan Tema */}
          <div className="pt-2 border-t border-border space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Tema Tampilan
            </span>
            <div className="flex justify-start">
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Auth CTA Actions */}
        <div className="pt-4 border-t border-border space-y-2.5">
          {user ? (
            <Link href="/dashboard" onClick={handleLinkClick} className="block w-full">
              <Button size="standard" className="w-full gap-2 font-semibold min-h-[44px]">
                <span>Buka Dashboard</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/register" onClick={handleLinkClick} className="block w-full">
                <Button size="standard" className="w-full gap-2 font-semibold min-h-[44px]">
                  <span>Daftar Akun Gratis</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/login" onClick={handleLinkClick} className="block w-full">
                <Button variant="outline" size="standard" className="w-full min-h-[44px]">
                  Masuk ke Akun
                </Button>
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
