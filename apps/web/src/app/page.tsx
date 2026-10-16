import Link from 'next/link';
import { getServerSessionUser } from '@/lib/auth-server';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PublicMobileNav } from '@/components/landing/public-mobile-nav';
import { ProductShowcase } from '@/components/landing/product-showcase';
import { FaqSection } from '@/components/landing/faq-section';
import {
  BookOpen,
  CalendarRange,
  ListTodo,
  FileText,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default async function HomePage(): Promise<React.JSX.Element> {
  const user = await getServerSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-x-clip">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-3.5 sm:px-6">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 transition-opacity hover:opacity-90"
            aria-label="Kembali ke beranda StudyFlow"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              StudyFlow
            </span>
          </Link>

          {/* Section Anchors & Theme / Auth Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground mr-2">
              <Link href="#fitur" className="hover:text-foreground transition-colors">
                Fitur
              </Link>
              <Link href="#cara-kerja" className="hover:text-foreground transition-colors">
                Cara Kerja
              </Link>
              <Link href="#faq" className="hover:text-foreground transition-colors">
                FAQ
              </Link>
            </nav>

            {/* Mobile Drawer Trigger (Sheet) */}
            <PublicMobileNav user={user} />

            <div className="hidden sm:inline-flex">
              <ThemeToggle />
            </div>

            {user ? (
              <Link href="/dashboard">
                <Button size="sm" className="h-8 px-2.5 sm:h-9 sm:px-3.5 text-xs sm:text-sm gap-1.5 font-semibold">
                  <span>Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm">
                    Masuk
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="h-8 px-2.5 sm:h-9 sm:px-3.5 text-xs sm:text-sm font-semibold">
                    Daftar
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Hero Section */}
          <section className="py-14 sm:py-20 lg:py-24 border-b border-border/60">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-4 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
                Platform Belajar Pribadi Mahasiswa
              </Badge>

              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight sm:leading-tight">
                Materi, tugas, dan catatan kuliah lebih teratur.
              </h1>

              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                StudyFlow adalah ruang belajar pribadi mahasiswa untuk mengelola semester,
                memantau tenggat tugas, merapikan catatan, dan memahami materi kuliah PDF
                dengan bantuan ringkasan, flashcard, serta kuis yang merujuk langsung ke dokumen sumber.
              </p>

              {/* Action CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {user ? (
                  <>
                    <Link href="/dashboard">
                      <Button size="lg" className="h-11 px-5 gap-2 font-semibold">
                        <span>Buka Dashboard Belajar</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                    <Link href="#fitur">
                      <Button size="lg" variant="outline" className="h-11 px-5">
                        Jelajahi Fitur
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/register">
                      <Button size="lg" className="h-11 px-5 gap-2 font-semibold">
                        <span>Mulai Belajar Sekarang</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                    <Link href="#cara-kerja">
                      <Button size="lg" variant="outline" className="h-11 px-5">
                        Lihat Cara Kerja
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Interactive Product UI Showcase */}
          <ProductShowcase />

          {/* Section: Fitur Inti */}
          <section id="fitur" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Fitur Nyata untuk Kebutuhan Kuliah Sehari-hari
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Dirancang khusus untuk mendukung proses belajar mandiri mahasiswa, tanpa kerumitan menu atau fitur yang berlebihan.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Fitur 1: Semester & Mata Kuliah */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarRange className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Semester & Mata Kuliah
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Pisahkan perkuliahan aktif dari semester yang telah selesai. Kelompokkan mata kuliah dengan dosen pengampu, jadwal, dan arsip materi terkait secara terpusat.
                </p>
              </div>

              {/* Fitur 2: Tugas Kuliah */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ListTodo className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Pemantauan Tugas
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Pantau batas pengumpulan tugas dengan penanda status terlambat, hari ini, dan mendatang sesuai zona waktu lokal Anda. Dilengkapi tingkat prioritas tugas.
                </p>
              </div>

              {/* Fitur 3: Catatan Belajar */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Catatan Kuliah Markdown
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Tulis catatan belajar bebas gangguan menggunakan format Markdown yang ringan. Tautkan catatan ke mata kuliah atau dokumen materi terkait.
                </p>
              </div>

              {/* Fitur 4: Pembaca PDF Terpadu */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Materi PDF & Rujukan Halaman
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Unggah file PDF materi perkuliahan dalam ruang baca yang nyaman. Seluruh hasil belajar AI terhubung langsung dengan nomor halaman dokumen sumber.
                </p>
              </div>

              {/* Fitur 5: Ringkasan AI */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Ringkasan Konsep Kunci
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Uraikan materi kuliah yang panjang menjadi poin-poin konsep penting, glosarium istilah, dan struktur bab yang mudah dipahami.
                </p>
              </div>

              {/* Fitur 6: Flashcard & Kuis */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  Flashcard & Kuis Latihan
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Latih daya ingat konsep dengan kartu belajar interaktif, dan evaluasi pemahaman melalui kuis pilihan ganda dengan pembahasan kunci jawaban.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Cara Kerja */}
          <section id="cara-kerja" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Alur Belajar Sederhana & Terarah
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Tiga tahapan teratur untuk menata perkuliahan dan memaksimalkan pemahaman materi Anda.
              </p>
            </div>

            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {/* Langkah 1 */}
              <div className="space-y-3">
                <div className="text-3xl font-extrabold tracking-tight text-primary font-mono">
                  01
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Atur Semester & Kuliah
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Tentukan semester aktif dan masukkan daftar mata kuliah yang sedang Anda tempuh, lengkap dengan kode kelas dan jadwal kuliah.
                </p>
              </div>

              {/* Langkah 2 */}
              <div className="space-y-3">
                <div className="text-3xl font-extrabold tracking-tight text-primary font-mono">
                  02
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Unggah Dokumen & Tugas
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Unggah berkas slide kuliah atau modul PDF berbasis teks, serta catat tugas-tugas perkuliahan dengan batas waktu pengumpulan.
                </p>
              </div>

              {/* Langkah 3 */}
              <div className="space-y-3">
                <div className="text-3xl font-extrabold tracking-tight text-primary font-mono">
                  03
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  Pelajari & Evaluasi Diri
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Baca materi sambil meninjau ringkasan konsep, latih hafalan lewat flashcard, dan uji kesiapan ujian dengan kuis mandiri.
                </p>
              </div>
            </div>
          </section>

          {/* Section FAQ Accordion Interaktif */}
          <FaqSection />

          {/* Pilar Transparansi & Privasi Data Akademik */}
          <section className="py-14 sm:py-20 border-b border-border/60">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <Badge variant="outline" className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
                Kedaulatan Data & Integritas
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Prinsip Belajar yang Transparan & Bertanggung Jawab
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Kami membangun StudyFlow dengan komitmen teguh terhadap kejujuran akademik dan keamanan data pribadi mahasiswa.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Pilar 1 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Verifiable AI (Bukan Chatbot Halusinasi)
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Seluruh bantuan belajar merujuk langsung ke nomor halaman dokumen PDF Anda. Anda tidak perlu menebak apakah ringkasan akurat karena rujukan aslinya dapat diperiksa dalam satu klik.
                </p>
              </div>

              {/* Pilar 2 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Privasi Penuh & Data Terisolasi
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Ruang belajar pribadi tanpa pelacak iklan pihak ketiga atau penggunaan data mahasiswa untuk pelatihan model AI publik. Materi kuliah Anda sepenuhnya milik Anda.
                </p>
              </div>

              {/* Pilar 3 */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  Sinkronisasi Zona Waktu Nyata
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Pengingat deadline H-1 dan pemantauan tugas disesuaikan dengan zona waktu kampus Anda (WIB, WITA, WIT, atau UTC). Mencegah keterlambatan tugas akibat salah konversi waktu.
                </p>
              </div>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="py-14 sm:py-20 text-center">
            <div className="mx-auto max-w-2xl space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Mulai Rapikan Perkuliahan Anda
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Ruang belajar pribadi yang terisolasi, aman, dan dirancang khusus untuk kenyamanan membaca dalam jangka panjang.
              </p>
              <div className="pt-3 flex flex-wrap justify-center items-center gap-3">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="h-11 px-6 font-semibold gap-2">
                      <span>Masuk ke Dashboard Belajar</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/register">
                      <Button size="lg" className="h-11 px-6 font-semibold gap-2">
                        <span>Daftar Akun StudyFlow</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button size="lg" variant="outline" className="h-11 px-6 font-medium">
                        Masuk ke Akun
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-border bg-card py-8 text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            StudyFlow &copy; 2026. Platform Belajar Pribadi Mahasiswa.
          </p>

          <nav className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium" aria-label="Navigasi footer">
            <Link href="/" className="hover:text-foreground transition-colors">
              Beranda
            </Link>
            <Link href="#fitur" className="hover:text-foreground transition-colors">
              Fitur
            </Link>
            <Link href="#cara-kerja" className="hover:text-foreground transition-colors">
              Cara Kerja
            </Link>
            <Link href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
            {user ? (
              <Link href="/dashboard" className="text-primary hover:underline">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Masuk
                </Link>
                <Link href="/register" className="hover:text-foreground transition-colors">
                  Daftar
                </Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
