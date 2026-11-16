import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getServerSessionUser } from '@/lib/auth-server';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FadeIn, StaggerGroup, StaggerItem } from '@/components/ui/motion';
import { PublicMobileNav } from '@/components/landing/public-mobile-nav';
import { ProductShowcase } from '@/components/landing/product-showcase';
import { FaqSection } from '@/components/landing/faq-section';
import { StudyFlowLogo } from '@/components/brand/studyflow-logo';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'StudyFlow — Ruang Belajar Pribadi Mahasiswa',
  description:
    'Platform belajar pribadi untuk mahasiswa: kelola semester, mata kuliah, tugas, catatan, dan materi PDF dengan bantuan ringkasan, flashcard, dan kuis AI.',
};

// Asset references (including backwards-compatible references for /images/hero-studyflow-workspace.svg, /images/feature-pdf-citation.svg, /images/feature-semester-schedule.svg, /images/feature-flashcard-quiz.svg)

export default async function HomePage(): Promise<React.JSX.Element> {
  const user = await getServerSessionUser();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-x-clip">
      {/* 1. Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-3.5 sm:px-6">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 transition-opacity hover:opacity-90"
            aria-label="Kembali ke beranda StudyFlow"
          >
            <StudyFlowLogo />
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
                <Button
                  size="sm"
                  className="h-8 px-2.5 sm:h-9 sm:px-3.5 text-xs sm:text-sm gap-1.5 font-semibold"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link href="/login" prefetch={false}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
                  >
                    Masuk
                  </Button>
                </Link>
                <Link href="/register" prefetch={false}>
                  <Button
                    size="sm"
                    className="h-8 px-2.5 sm:h-9 sm:px-3.5 text-xs sm:text-sm font-semibold"
                  >
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Hero Section: 2 Kolom Asimetris Editorial */}
          <section className="py-8 sm:py-12 lg:py-16 border-b border-border/60">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Kolom Kiri (6 cols) */}
              <div className="lg:col-span-6">
                <Badge
                  variant="secondary"
                  className="mb-4 text-xs font-medium tracking-wide"
                >
                  Ruang Belajar Pribadi Mahasiswa
                </Badge>

                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[44px] leading-tight">
                  Materi, tugas, dan catatan kuliah lebih teratur.
                </h1>

                <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                  StudyFlow adalah ruang belajar pribadi untuk mahasiswa dari semua jurusan. Kelola semester, pantau tenggat tugas, rapikan catatan kuliah, dan pelajari materi PDF dengan bantuan ringkasan, flashcard, serta kuis yang merujuk langsung ke dokumen sumber.
                </p>

                {/* Action CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  {user ? (
                    <>
                      <Link href="/dashboard">
                        <Button size="lg" className="h-11 px-6 font-semibold gap-2">
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
                      <Link href="/register" prefetch={false}>
                        <Button size="lg" className="h-11 px-6 font-semibold gap-2">
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

                {/* Strip 3 Metrik Spesifikasi Jujur */}
                <div className="mt-8 pt-6 border-t border-border/60 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>Maks. 100 Hal / PDF</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>Rujukan Halaman Asli</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>WIB &bull; WITA &bull; WIT</span>
                  </div>
                </div>
              </div>

              {/* Kolom Kanan (6 cols): Visual Editorial Utama (LCP Element) */}
              <div className="lg:col-span-6">
                <div className="relative aspect-[17/12] w-full overflow-hidden rounded-2xl border border-border shadow-sm">
                  <Image
                    src="/images/hero-editorial-workspace.svg"
                    alt="Pratinjau ruang belajar StudyFlow dengan pembaca materi PDF dan rujukan halaman"
                    width={680}
                    height={480}
                    priority
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 680px"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Product UI Showcase */}
          <ProductShowcase />

          {/* Section: Fitur Utama */}
          <section id="fitur" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
            <FadeIn className="max-w-2xl">
              <div className="text-xs text-primary dark:text-indigo-400 font-bold tracking-wider uppercase mb-2">
                Fitur Utama
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Fitur Nyata untuk Kebutuhan Kuliah Sehari-hari
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Dirancang khusus untuk mendukung proses belajar mandiri mahasiswa dari berbagai bidang studi, tanpa menu rumit yang mengganggu fokus.
              </p>
            </FadeIn>

            <StaggerGroup className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Kartu Utama 1 (Lebar 7 Kolom — Bergambar) */}
              <StaggerItem className="flex md:col-span-7">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs overflow-hidden">
                  <div className="p-4 sm:p-5 pb-0 bg-muted/30 border-b border-border/60">
                    <Image
                      src="/images/visual-pdf-citation.svg"
                      alt="Ilustrasi rujukan halaman PDF langsung ke konsep kunci"
                      width={400}
                      height={220}
                      className="w-full h-auto rounded-lg border border-border/60"
                    />
                  </div>
                  <CardHeader className="pt-5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold tracking-wide text-primary dark:text-indigo-400 uppercase">01 &bull; Materi &amp; Rujukan</span>
                    </div>
                    <CardTitle className="text-lg sm:text-xl">
                      Materi PDF &amp; Rujukan Halaman Presisi
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Unggah file PDF materi kuliah dalam ruang baca yang nyaman. Seluruh ringkasan konsep, daftar istilah penting, hingga flashcard terhubung langsung dengan nomor halaman dokumen asli agar mudah diperiksa kembali.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Kartu Utama 2 (Lebar 5 Kolom — Blok Aksen Editorial Indigo) */}
              <StaggerItem className="flex md:col-span-5">
                <div className="flex flex-col justify-between w-full rounded-xl bg-primary text-primary-foreground p-6 shadow-sm overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        02 &bull; Latihan Pemahaman
                      </span>
                      <span className="rounded-md bg-black/30 border border-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                        Kuis &amp; Kartu
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                      Latihan Flashcard &amp; Kuis Evaluasi
                    </h3>
                    <p className="mt-2 text-sm text-white/95 leading-relaxed">
                      Latih daya ingat Anda lewat kartu belajar interaktif. Uji pemahaman materi secara mandiri dengan kuis pilihan ganda yang menampilkan skor instan beserta pembahasan rujukan halaman.
                    </p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/15">
                    <Image
                      src="/images/visual-flashcard-quiz.svg"
                      alt="Ilustrasi latihan flashcard dan evaluasi kuis mandiri"
                      width={400}
                      height={220}
                      className="w-full h-auto rounded-lg border border-white/20 shadow-xs"
                    />
                  </div>
                </div>
              </StaggerItem>

              {/* Kartu Utama 3 (Lebar 5 Kolom — Bergambar) */}
              <StaggerItem className="flex md:col-span-5">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold tracking-wide text-primary dark:text-indigo-400 uppercase">03 &bull; Manajemen Akademik</span>
                    </div>
                    <CardTitle className="text-lg sm:text-xl">
                      Semester, Jadwal Kuliah, &amp; Deteksi Benturan
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Pisahkan semester aktif dari arsip semester lalu. Atur jadwal kuliah mingguan dengan pengecekan otomatis agar tidak ada jadwal kelas atau praktikum yang bentrok waktu maupun ruangan.
                    </CardDescription>
                  </CardHeader>
                  <div className="p-4 sm:p-5 pt-0">
                    <Image
                      src="/images/visual-semester-schedule.svg"
                      alt="Ilustrasi jadwal kuliah mingguan bebas benturan"
                      width={400}
                      height={220}
                      className="w-full h-auto rounded-lg border border-border/60"
                    />
                  </div>
                </Card>
              </StaggerItem>

              {/* Kartu Utama 4 (Lebar 7 Kolom — Kombinasi Tugas, Subtugas, & Catatan Kuliah) */}
              <StaggerItem className="flex md:col-span-7">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs p-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold tracking-wide text-primary dark:text-indigo-400 uppercase">04 &bull; Produktivitas Belajar</span>
                      <span className="text-xs font-medium text-muted-foreground">Subtugas &bull; Catatan Rapi</span>
                    </div>
                    <CardTitle className="text-lg sm:text-xl">
                      Pemantauan Tugas &amp; Catatan Kuliah Terstruktur
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Pecah tugas kuliah besar menjadi langkah subtugas yang mudah dipantau progresnya. Tulis catatan kuliah yang rapi dan tertaut langsung dengan mata kuliah terkait.
                    </CardDescription>
                  </div>

                  {/* Pratinjau Mikro: Checklist Subtugas & Catatan Kuliah */}
                  <div aria-hidden="true" className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Subtugas Preview Mini */}
                    <div className="rounded-lg border border-border/80 bg-muted/40 p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span>Makalah Kajian Pustaka</span>
                        <span className="font-mono text-primary dark:text-indigo-400 tabular-nums">2 / 3</span>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full w-2/3" />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 line-through text-muted-foreground dark:text-zinc-400">
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Kumpulkan referensi jurnal utama</span>
                        </div>
                        <div className="flex items-center gap-2 line-through text-muted-foreground dark:text-zinc-400">
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Susun kerangka dan kajian teori</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium">
                          <div className="size-3.5 rounded-sm border border-primary shrink-0" />
                          <span>Finalisasi kesimpulan &amp; daftar pustaka</span>
                        </div>
                      </div>
                    </div>

                    {/* Catatan Kuliah Preview Mini */}
                    <div className="rounded-lg border border-border/80 bg-card p-3.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-muted-foreground pb-1 border-b border-border/50 text-xs">
                        <span className="font-medium">Catatan Metodologi</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Tersimpan</span>
                      </div>
                      <p className="text-primary dark:text-indigo-400 font-bold">Ringkasan Pengambilan Data</p>
                      <p className="text-foreground/80">&bull; Primer: survei dan wawancara langsung</p>
                      <p className="text-foreground/80">&bull; Sekunder: jurnal dan laporan resmi</p>
                      <div className="rounded bg-muted px-2 py-1 text-muted-foreground text-xs">
                        Rujukan: Modul Kuliah Hal. 04
                      </div>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Section: 3 Pilar Integritas Akademik & Keamanan */}
          <section className="py-14 sm:py-20 border-b border-border/60">
            <FadeIn className="max-w-2xl">
              <div className="text-xs text-primary dark:text-indigo-400 font-bold tracking-wider uppercase mb-2">
                Kepercayaan &amp; Privasi
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Prinsip Integritas Akademik &amp; Keamanan
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Kami membangun StudyFlow dengan komitmen penuh terhadap kejujuran akademik dan kerahasiaan data pribadi mahasiswa.
              </p>
            </FadeIn>

            <StaggerGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Pilar 1 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-indigo-400 mb-2">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      AI Merujuk Sumber Materi Asli
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm leading-relaxed">
                      AI tidak mengarang jawaban secara bebas, melainkan merangkum langsung dari dokumen PDF kuliah yang Anda unggah lengkap beserta kutipan nomor halamannya.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Pilar 2 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-indigo-400 mb-2">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Privasi Penuh &amp; Milik Pribadi
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm leading-relaxed">
                      Dokumen materi, tugas, jadwal, dan catatan Anda adalah milik Anda sepenuhnya. Data hanya dapat diakses melalui akun Anda dan tidak pernah dipakai melatih AI publik.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Pilar 3 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-indigo-400 mb-2">
                      <Clock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Sinkronisasi Zona Waktu Lokal
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm leading-relaxed">
                      Pengingat tenggat tugas dan jadwal kuliah disesuaikan dengan zona waktu tempat Anda belajar (WIB, WITA, WIT, atau zona lainnya) agar terhindar dari salah jadwal.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Section: Alur Kerja Editorial (3 Langkah) */}
          <section id="cara-kerja" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
            <FadeIn className="max-w-2xl">
              <div className="text-xs text-primary dark:text-indigo-400 font-bold tracking-wider uppercase mb-2">
                Cara Kerja
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Alur Belajar Sederhana &amp; Terarah
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Tiga tahapan teratur untuk menata perkuliahan dan memaksimalkan pemahaman materi Anda.
              </p>
            </FadeIn>

            <StaggerGroup className="mt-10 grid gap-6 md:grid-cols-3">
              {/* Langkah 1 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs relative overflow-hidden">
                  <svg
                    aria-hidden="true"
                    className="absolute top-4 right-4 h-9 w-12 text-muted/40 font-mono select-none pointer-events-none"
                    viewBox="0 0 48 32"
                    fill="currentColor"
                  >
                    <text x="44" y="26" textAnchor="end" fontSize="28" fontWeight="800" fontFamily="monospace">
                      01
                    </text>
                  </svg>
                  <CardHeader>
                    <div className="text-xs font-bold tracking-wide uppercase text-primary dark:text-indigo-400 mb-2">
                      Langkah 01
                    </div>
                    <CardTitle className="text-lg">
                      Atur Semester, Mata Kuliah, &amp; Jadwal Mingguan
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Tentukan semester aktif dan masukkan daftar mata kuliah yang sedang Anda tempuh, lengkap dengan kode kelas, nama dosen, dan jadwal kuliah bebas benturan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-md border border-border/80 bg-muted/40 p-2.5 text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>MKU204 Metodologi Riset</span>
                      <Badge variant="outline" className="text-xs font-mono tabular-nums">21 SKS</Badge>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Langkah 2 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs relative overflow-hidden">
                  <svg
                    aria-hidden="true"
                    className="absolute top-4 right-4 h-9 w-12 text-muted/40 font-mono select-none pointer-events-none"
                    viewBox="0 0 48 32"
                    fill="currentColor"
                  >
                    <text x="44" y="26" textAnchor="end" fontSize="28" fontWeight="800" fontFamily="monospace">
                      02
                    </text>
                  </svg>
                  <CardHeader>
                    <div className="text-xs font-bold tracking-wide uppercase text-primary dark:text-indigo-400 mb-2">
                      Langkah 02
                    </div>
                    <CardTitle className="text-lg">
                      Unggah Modul PDF &amp; Catat Tenggat Tugas
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Simpan berkas PDF modul kuliah (hingga 20 MB / 100 halaman). Catat deadline tugas dan pecah ke dalam subtugas yang disinkronkan dengan zona waktu lokal Anda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-md border border-border/80 bg-muted/40 p-2.5 text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>modul-kuliah.pdf</span>
                      <span className="text-primary dark:text-indigo-400 font-semibold">Maks 100 Hal</span>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Langkah 3 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs relative overflow-hidden">
                  <svg
                    aria-hidden="true"
                    className="absolute top-4 right-4 h-9 w-12 text-muted/40 font-mono select-none pointer-events-none"
                    viewBox="0 0 48 32"
                    fill="currentColor"
                  >
                    <text x="44" y="26" textAnchor="end" fontSize="28" fontWeight="800" fontFamily="monospace">
                      03
                    </text>
                  </svg>
                  <CardHeader>
                    <div className="text-xs font-bold tracking-wide uppercase text-primary dark:text-indigo-400 mb-2">
                      Langkah 03
                    </div>
                    <CardTitle className="text-lg">
                      Pelajari Ringkasan Ber-rujukan, Flashcard, &amp; Kuis
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Pahami intisari dokumen dengan nomor halaman rujukan asli. Uji pemahaman materi secara aktif lewat kartu flashcard dan latihan kuis berpenilaian otomatis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-md border border-border/80 bg-muted/40 p-2.5 text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>Latihan Mandiri</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rujukan Halaman Asli</span>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Section: Pertanyaan yang Sering Diajukan (FAQ) */}
          <FaqSection />

          {/* Bottom CTA — Two-sided Editorial Layout */}
          <section className="py-14 sm:py-20">
            <FadeIn>
              <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left side (7 cols): Heading & CTAs */}
                <div className="lg:col-span-7 space-y-4">
                  <Badge variant="secondary" className="text-xs font-medium">
                    StudyFlow untuk Mahasiswa
                  </Badge>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Mulai Rapikan Perkuliahan Anda
                  </h2>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                    Ruang belajar pribadi yang tenang, rapi, dan dirancang khusus untuk kenyamanan membaca dalam jangka panjang tanpa distraksi media sosial.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    {user ? (
                      <Link href="/dashboard">
                        <Button size="lg" className="h-11 px-6 font-semibold gap-2">
                          <span>Masuk ke Dashboard Belajar</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </Link>
                    ) : (
                      <>
                        <Link href="/register" prefetch={false}>
                          <Button size="lg" className="h-11 px-6 font-semibold gap-2">
                            <span>Daftar Akun StudyFlow</span>
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </Link>
                        <Link href="/login" prefetch={false}>
                          <Button size="lg" variant="outline" className="h-11 px-6 font-medium">
                            Masuk ke Akun
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>

                {/* Right side (5 cols): Privacy & Usage Commitment Block */}
                <div className="lg:col-span-5 rounded-xl border border-border/80 bg-muted/40 p-5 text-xs space-y-3">
                  <div className="text-xs font-bold text-primary dark:text-indigo-400 uppercase tracking-wider">
                    Komitmen Privasi &amp; Penggunaan
                  </div>
                  <div className="space-y-2.5 text-muted-foreground leading-relaxed">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="size-4 text-primary dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span className="text-foreground">Materi, catatan, dan tugas tersimpan aman khusus di akun pribadi Anda</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Dokumen materi kuliah Anda tidak digunakan untuk melatih model AI publik</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="size-4 text-primary dark:text-indigo-400 shrink-0 mt-0.5" />
                      <span>Pengingat jadwal dan tenggat otomatis menyesuaikan zona waktu lokal Anda</span>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-border/60 text-xs text-muted-foreground">
                    Gratis dengan kuota harian wajar: 20 pembuatan AI/hari &bull; Maks. 20 MB/dokumen
                  </div>
                </div>
              </div>
            </FadeIn>
          </section>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-border bg-card py-8 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="transition-opacity hover:opacity-90"
              aria-label="Kembali ke beranda StudyFlow"
            >
              <StudyFlowLogo size="sm" />
            </Link>
            <p>StudyFlow &copy; 2026. Platform Belajar Pribadi Mahasiswa.</p>
          </div>

          <nav
            className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium"
            aria-label="Navigasi footer"
          >
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
              <Link href="/dashboard" className="text-primary dark:text-indigo-400 hover:underline">
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
