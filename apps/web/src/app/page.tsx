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
  BookOpen,
  CalendarRange,
  ListTodo,
  FileText,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

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
                <Link href="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
                  >
                    Masuk
                  </Button>
                </Link>
                <Link href="/register">
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
          {/* Hero Section Split-Layout */}
          <section className="py-12 sm:py-16 lg:py-20 border-b border-border/60">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left Column (7 cols) */}
              <FadeIn className="lg:col-span-7">
                <Badge
                  variant="secondary"
                  className="mb-4 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
                >
                  Platform Belajar Pribadi Mahasiswa
                </Badge>

                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[44px] leading-tight">
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
              </FadeIn>

              {/* Right Column (5 cols): Hero Visual Mockup */}
              <FadeIn delay={0.08} className="lg:col-span-5">
                <Card className="overflow-hidden border-border/80 bg-card shadow-xs p-2">
                  <Image
                    src="/images/hero-studyflow-workspace.svg"
                    alt="Pratinjau ruang belajar StudyFlow"
                    width={640}
                    height={440}
                    priority
                    className="w-full h-auto rounded-lg border border-border/50"
                  />
                </Card>
              </FadeIn>
            </div>
          </section>

          {/* Interactive Product UI Showcase */}
          <ProductShowcase />

          {/* Section: Fitur Inti (Bento Grid with Visual Illustrations & shadcn Card) */}
          <section id="fitur" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
            <FadeIn className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Fitur Nyata untuk Kebutuhan Kuliah Sehari-hari
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Dirancang khusus untuk mendukung proses belajar mandiri mahasiswa, tanpa kerumitan menu atau fitur yang berlebihan.
              </p>
            </FadeIn>

            <StaggerGroup className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Fitur 1: Materi PDF & Rujukan Halaman (with illustration) */}
              <StaggerItem className="flex">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <BookOpen className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Materi PDF & Rujukan Halaman
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Unggah file PDF materi perkuliahan dalam ruang baca yang nyaman. Seluruh hasil belajar AI terhubung langsung dengan nomor halaman dokumen sumber.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Image
                      src="/images/feature-pdf-citation.svg"
                      alt="Ilustrasi rujukan halaman PDF langsung ke konsep kunci"
                      width={420}
                      height={220}
                      className="w-full h-auto rounded-lg border border-border/60"
                    />
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Fitur 2: Semester, Jadwal & Tugas (with illustration) */}
              <StaggerItem className="flex">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <CalendarRange className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Semester & Mata Kuliah
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Pisahkan perkuliahan aktif dari semester yang telah selesai. Kelompokkan mata kuliah dengan dosen pengampu, jadwal, dan arsip materi terkait secara terpusat.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Image
                      src="/images/feature-semester-schedule.svg"
                      alt="Ilustrasi jadwal kuliah mingguan dan progres subtugas"
                      width={420}
                      height={220}
                      className="w-full h-auto rounded-lg border border-border/60"
                    />
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Fitur 3: Flashcard & Kuis Latihan (with illustration) */}
              <StaggerItem className="flex">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs">
                  <CardHeader className="pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <Layers className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Flashcard & Kuis Latihan
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Latih daya ingat konsep dengan kartu belajar interaktif, dan evaluasi pemahaman melalui kuis pilihan ganda dengan pembahasan kunci jawaban.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Image
                      src="/images/feature-flashcard-quiz.svg"
                      alt="Ilustrasi latihan flashcard active recall dan evaluasi kuis"
                      width={420}
                      height={220}
                      className="w-full h-auto rounded-lg border border-border/60"
                    />
                  </CardContent>
                </Card>
              </StaggerItem>

              {/* Fitur 4: Pemantauan Tugas */}
              <StaggerItem className="flex">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <ListTodo className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Pemantauan Tugas
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Pantau batas pengumpulan tugas dengan penanda status terlambat, hari ini, dan mendatang sesuai zona waktu lokal Anda. Dilengkapi tingkat prioritas tugas.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Fitur 5: Catatan Kuliah Markdown */}
              <StaggerItem className="flex">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <FileText className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Catatan Kuliah Markdown
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Tulis catatan belajar bebas gangguan menggunakan format Markdown yang ringan. Tautkan catatan ke mata kuliah atau dokumen materi terkait.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Fitur 6: Ringkasan Konsep Kunci */}
              <StaggerItem className="flex">
                <Card className="flex flex-col justify-between w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Ringkasan Konsep Kunci
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Uraikan materi kuliah yang panjang menjadi poin-poin konsep penting, glosarium istilah, dan struktur bab yang mudah dipahami.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Section: Cara Kerja */}
          <section id="cara-kerja" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
            <FadeIn className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Alur Belajar Sederhana & Terarah
              </h2>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Tiga tahapan teratur untuk menata perkuliahan dan memaksimalkan pemahaman materi Anda.
              </p>
            </FadeIn>

            <StaggerGroup className="mt-10 grid gap-6 md:grid-cols-3">
              {/* Langkah 1 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="text-2xl font-extrabold tracking-tight text-primary font-mono tabular-nums mb-1">
                      01
                    </div>
                    <CardTitle className="text-lg">
                      Atur Semester & Kuliah
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Tentukan semester aktif dan masukkan daftar mata kuliah yang sedang Anda tempuh, lengkap dengan kode kelas dan jadwal kuliah.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Langkah 2 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="text-2xl font-extrabold tracking-tight text-primary font-mono tabular-nums mb-1">
                      02
                    </div>
                    <CardTitle className="text-lg">
                      Unggah Dokumen & Tugas
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Unggah berkas slide kuliah atau modul PDF berbasis teks, serta catat tugas-tugas perkuliahan dengan batas waktu pengumpulan.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Langkah 3 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="text-2xl font-extrabold tracking-tight text-primary font-mono tabular-nums mb-1">
                      03
                    </div>
                    <CardTitle className="text-lg">
                      Pelajari & Evaluasi Diri
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Baca materi sambil meninjau ringkasan konsep, latih hafalan lewat flashcard, dan uji kesiapan ujian dengan kuis mandiri.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Section FAQ Accordion Interaktif */}
          <FaqSection />

          {/* Pilar Transparansi & Privasi Data Akademik */}
          <section className="py-14 sm:py-20 border-b border-border/60">
            <FadeIn className="max-w-2xl mx-auto text-center mb-10">
              <Badge
                variant="secondary"
                className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
              >
                Kedaulatan Data & Integritas
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Prinsip Belajar yang Transparan & Bertanggung Jawab
              </h2>
              <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Kami membangun StudyFlow dengan komitmen teguh terhadap kejujuran akademik dan keamanan data pribadi mahasiswa.
              </p>
            </FadeIn>

            <StaggerGroup className="grid gap-6 md:grid-cols-3">
              {/* Pilar 1 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Verifiable AI (Bukan Chatbot Halusinasi)
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm leading-relaxed">
                      Seluruh bantuan belajar merujuk langsung ke nomor halaman dokumen PDF Anda. Anda tidak perlu menebak apakah ringkasan akurat karena rujukan aslinya dapat diperiksa dalam satu klik.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Pilar 2 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Privasi Penuh & Data Terisolasi
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm leading-relaxed">
                      Ruang belajar pribadi tanpa pelacak iklan pihak ketiga atau penggunaan data mahasiswa untuk pelatihan model AI publik. Materi kuliah Anda sepenuhnya milik Anda.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>

              {/* Pilar 3 */}
              <StaggerItem className="flex">
                <Card className="w-full border-border bg-card shadow-xs">
                  <CardHeader>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                      <Clock className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-base">
                      Sinkronisasi Zona Waktu Nyata
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm leading-relaxed">
                      Pengingat deadline H-1 dan pemantauan tugas disesuaikan dengan zona waktu kampus Anda (WIB, WITA, WIT, atau UTC). Mencegah keterlambatan tugas akibat salah konversi waktu.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </StaggerItem>
            </StaggerGroup>
          </section>

          {/* Bottom CTA */}
          <section className="py-14 sm:py-20 text-center">
            <FadeIn className="mx-auto max-w-2xl space-y-4">
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
