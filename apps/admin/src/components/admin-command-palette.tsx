'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Sparkles,
  Search,
  Sun,
  Moon,
  Laptop,
  BookOpen,
  CheckSquare,
  StickyNote,
  Calendar,
  HelpCircle,
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';

interface AdminCommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdminCommandPalette({
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: AdminCommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const router = useRouter();
  const { setTheme } = useTheme();

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (isControlled && externalOnOpenChange) {
        externalOnOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [isControlled, externalOnOpenChange]
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const handleSelect = React.useCallback(
    (callback: () => void) => {
      setOpen(false);
      setSearch('');
      callback();
    },
    [setOpen]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Ketik perintah, nama halaman, atau cari pengguna..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center justify-center gap-1.5 py-4">
            <p className="text-xs text-muted-foreground">Tidak ada hasil yang sesuai.</p>
            {search.trim().length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1 gap-1.5 text-xs h-7"
                onClick={() =>
                  handleSelect(() => {
                    router.push(`/users?search=${encodeURIComponent(search.trim())}`);
                  })
                }
              >
                <Search className="h-3 w-3" />
                Cari &quot;{search.trim()}&quot; di Direktori Pengguna
              </Button>
            )}
          </div>
        </CommandEmpty>

        {/* 1. Navigasi Halaman Utama */}
        <CommandGroup heading="Sistem & Operasional">
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/dashboard'))}
          >
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <span>Dashboard Administrator</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/users'))}
          >
            <Users className="h-4 w-4 text-emerald-500" />
            <span>Direktori Pengguna Mahasiswa</span>
            <CommandShortcut>G U</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/jobs'))}
          >
            <Briefcase className="h-4 w-4 text-blue-500" />
            <span>Monitoring Pekerjaan & Antrean AI</span>
            <CommandShortcut>G J</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 2. Navigasi Data Akademik */}
        <CommandGroup heading="Data Akademik">
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/courses'))}
          >
            <BookOpen className="h-4 w-4 text-indigo-500" />
            <span>Mata Kuliah Seluruh Mahasiswa</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/materials'))}
          >
            <FileText className="h-4 w-4 text-sky-500" />
            <span>Materi Kuliah & Dokumen PDF</span>
            <CommandShortcut>G M</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/assignments'))}
          >
            <CheckSquare className="h-4 w-4 text-amber-500" />
            <span>Tugas Kuliah & Subtugas</span>
            <CommandShortcut>G A</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/notes'))}
          >
            <StickyNote className="h-4 w-4 text-rose-500" />
            <span>Catatan Kuliah Mahasiswa</span>
            <CommandShortcut>G N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/schedules'))}
          >
            <Calendar className="h-4 w-4 text-teal-500" />
            <span>Jadwal Perkuliahan Mingguan</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/quizzes'))}
          >
            <HelpCircle className="h-4 w-4 text-violet-500" />
            <span>Kuis & Latihan AI</span>
            <CommandShortcut>G Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 2. Filter Cepat Pekerjaan Background */}
        <CommandGroup heading="Filter Monitoring Pekerjaan">
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/jobs?status=FAILED'))}
          >
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>Pekerjaan Gagal (Status: Failed)</span>
            <CommandShortcut>FAILED</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/jobs?status=PROCESSING'))}
          >
            <Clock className="h-4 w-4 text-amber-500" />
            <span>Pekerjaan Sedang Berjalan (Processing)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/jobs?status=COMPLETED'))}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Pekerjaan Selesai (Completed)</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => router.push('/jobs?type=DOCUMENT_EXTRACTION'))
            }
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Tipe: Ekstraksi Dokumen PDF</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/jobs?type=AI_SUMMARY'))}
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>Tipe: Generasi Ringkasan AI</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => router.push('/jobs?type=AI_FLASHCARD'))
            }
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>Tipe: Generasi Flashcard AI</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => router.push('/jobs?type=AI_QUIZ'))}
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span>Tipe: Generasi Kuis AI</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* 3. Tampilan & Pengaturan Tema */}
        <CommandGroup heading="Pengaturan Tema">
          <CommandItem onSelect={() => handleSelect(() => setTheme('light'))}>
            <Sun className="h-4 w-4 text-amber-500" />
            <span>Ganti ke Mode Terang (Light)</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setTheme('dark'))}>
            <Moon className="h-4 w-4 text-indigo-400" />
            <span>Ganti ke Mode Gelap (Dark)</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setTheme('system'))}>
            <Laptop className="h-4 w-4 text-muted-foreground" />
            <span>Ganti ke Tema Sistem (Auto)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative h-9 w-full justify-start rounded-lg bg-muted/40 text-xs font-normal text-muted-foreground shadow-none sm:w-64 md:w-80 lg:w-96 hover:bg-muted/70 hover:text-foreground"
      aria-label="Buka pencarian cepat (Ctrl+K)"
    >
      <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-60" />
      <span className="inline-flex">Cari atau navigasi cepat...</span>
      <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100 sm:flex">
        <span>⌘</span>K
      </kbd>
    </Button>
  );
}
