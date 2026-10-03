import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Layers,
  Server,
  Database,
  Cpu,
  ShieldCheck,
} from 'lucide-react';

export default function HomePage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-lg font-semibold tracking-tight text-foreground">
                StudyFlow
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          {/* Milestone & Product Intro */}
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 py-1 text-xs font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Milestone 1 — Foundation
              </Badge>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Atur perkuliahanmu dan pelajari materi sendiri dalam satu tempat.
            </h1>

            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              StudyFlow adalah platform belajar pribadi untuk mahasiswa yang menggabungkan
              pengelolaan mata kuliah, tugas, catatan, dan materi PDF dengan bantuan ringkasan,
              flashcard, dan kuis yang merujuk langsung ke sumber dokumen.
            </p>
          </div>

          {/* Architecture & Capabilities Overview */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Core Capability 1 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Layers className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-card-foreground">
                Organisasi Perkuliahan
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Pemisahan data per semester, pengelolaan mata kuliah, pemantauan deadline tugas,
                serta catatan materi terintegrasi dalam ruang pribadi yang terisolasi.
              </p>
            </div>

            {/* Core Capability 2 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-card-foreground">
                Pembelajaran Berbasis Sumber
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Unggah materi PDF kuliah dan hasilkan ringkasan, set flashcard, serta kuis latihan
                yang selalu menyertakan rujukan halaman asli dokumen.
              </p>
            </div>

            {/* Core Capability 3 */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-card-foreground">
                Privasi & Kontrol Akun
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Arsitektur terpisah antara antarmuka, API bisnis, dan pemroses latar belakang
                menjamin keamanan data, isolasi antar-pengguna, dan pengelolaan kuota.
              </p>
            </div>
          </div>

          {/* Foundation Status Section */}
          <div className="mt-12 rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">
                  Status Fondasi Sistem
                </h2>
                <p className="text-sm text-muted-foreground">
                  Layanan lokal dan dependensi monorepo yang disiapkan pada Milestone 1.
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Struktur Siap</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/50 p-4">
                <Server className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-foreground">Next.js App Router</div>
                  <div className="text-xs text-muted-foreground">apps/web (Port 3000)</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/50 p-4">
                <Server className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-foreground">Express REST API</div>
                  <div className="text-xs text-muted-foreground">apps/api (Port 4000)</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/50 p-4">
                <Database className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-foreground">PostgreSQL & Prisma</div>
                  <div className="text-xs text-muted-foreground">packages/database</div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-background/50 p-4">
                <Cpu className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-foreground">BullMQ & Redis</div>
                  <div className="text-xs text-muted-foreground">apps/worker</div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
              Tahap berikutnya: <strong className="text-foreground font-semibold">Milestone 2 — Authentication & Shell UI</strong> (registrasi, login JWT, refresh cookie, dan navigasi aplikasi).
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Accessible Footer */}
      <footer className="border-t border-border bg-card py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p>StudyFlow &copy; 2026. Platform Belajar Pribadi Mahasiswa.</p>
        </div>
      </footer>
    </div>
  );
}
