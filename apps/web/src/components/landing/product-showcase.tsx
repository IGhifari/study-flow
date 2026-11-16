'use client';

import * as React from 'react';
import {
  BookOpen,
  ListTodo,
  CalendarClock,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ExternalLink,
  MapPin,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AnimatedPanel, FadeIn } from '@/components/ui/motion';

type ShowcaseTab = 'pdf' | 'tasks' | 'schedule' | 'quiz';

export function ProductShowcase(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<ShowcaseTab>('pdf');

  // Interactive states for Tab 1 (PDF)
  const [highlightPage, setHighlightPage] = React.useState<boolean>(false);

  // Interactive states for Tab 2 (Tasks)
  const [subtasks, setSubtasks] = React.useState<
    Array<{ id: number; text: string; done: boolean }>
  >([
    { id: 1, text: 'Kumpulkan minimal 5 jurnal rujukan utama', done: true },
    { id: 2, text: 'Susun latar belakang dan rumusan masalah penelitian', done: true },
    { id: 3, text: 'Lengkapi daftar pustaka dan periksa kutipan halaman', done: false },
  ]);

  // Interactive states for Tab 4 (Flashcard & Quiz)
  const [isFlipped, setIsFlipped] = React.useState(false);
  const [quizSelectedOption, setQuizSelectedOption] = React.useState<number | null>(null);

  const toggleSubtask = (id: number) => {
    setSubtasks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const completedCount = subtasks.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / subtasks.length) * 100);

  const tabs: Array<{
    id: ShowcaseTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'pdf', label: 'Pembaca PDF & Rujukan', icon: BookOpen },
    { id: 'tasks', label: 'Manajemen Tugas', icon: ListTodo },
    { id: 'schedule', label: 'Jadwal Kuliah', icon: CalendarClock },
    { id: 'quiz', label: 'Flashcard & Kuis', icon: Layers },
  ];

  return (
    <section className="py-12 sm:py-16 border-b border-border/60">
      <FadeIn className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <Badge
          variant="secondary"
          className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary dark:text-indigo-400"
        >
          Antarmuka Produk Nyata
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Dirancang untuk Fokus Belajar Tanpa Distraksi
        </h2>
        <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Eksplorasi cuplikan interaktif di bawah untuk melihat bagaimana StudyFlow membantu perkuliahan Anda setiap hari.
        </p>
      </FadeIn>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as ShowcaseTab)}
        className="w-full"
      >
        <div className="flex justify-center mb-6">
          <TabsList
            aria-label="Pilih fitur pratinjau StudyFlow"
            className="h-auto flex-wrap gap-1.5 p-1.5 rounded-xl bg-muted/70 border border-border max-w-full"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  id={`showcase-tab-${tab.id}`}
                  aria-controls={`showcase-panel-${tab.id}`}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm touch-manipulation"
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <Card className="border-border bg-card shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <AnimatedPanel panelKey={activeTab}>
              {/* TAB 1: PDF & RUJUKAN HALAMAN */}
              <TabsContent value="pdf" id="showcase-panel-pdf" className="mt-0">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground truncate max-w-[280px] sm:max-w-md">
                        Modul_Kuliah_Bab4_Metodologi_Penelitian_Kualitatif.pdf
                      </span>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <Badge
                        variant={highlightPage ? 'default' : 'secondary'}
                        className="font-mono text-xs tabular-nums"
                      >
                        Halaman 4 / 28
                      </Badge>
                      <span className="text-muted-foreground hidden sm:inline">
                        • Pas Lebar
                      </span>
                    </div>
                  </div>

                  {/* Split View Simulation */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-[340px]">
                    {/* Sisi Kiri: Cuplikan Halaman PDF */}
                    <Card
                      className={`lg:col-span-7 transition-colors duration-200 ${
                        highlightPage
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <CardHeader className="pb-3 border-b border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Modul Perkuliahan — Hal. 4
                          </span>
                          <Badge variant="outline" className="text-xs font-medium">
                            MKU204 Metodologi Riset
                          </Badge>
                        </div>
                        <CardTitle className="text-base sm:text-lg pt-1">
                          4.2 Teknik Triangulasi &amp; Keabsahan Data
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                          Triangulasi data adalah metode pemeriksaan keabsahan temuan dengan membandingkan beragam sumber atau teknik pengumpulan data agar hasil penelitian tetap objektif:
                        </p>
                        <div className="rounded-lg bg-card border border-border p-3 text-xs text-foreground space-y-1.5 leading-relaxed">
                          <div className="text-primary dark:text-indigo-400 font-semibold">
                            Prinsip Pemeriksaan Data:
                          </div>
                          <div>&bull; Triangulasi Sumber: bandingkan data wawancara, arsip, dan dokumen</div>
                          <div>&bull; Triangulasi Teknik: padukan observasi lapangan dengan kuesioner</div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          <strong>Poin Utama:</strong> Kesesuaian temuan dari beberapa sudut pandang membantu mengurangi bias penafsiran pada kesimpulan penelitian.
                        </p>
                      </CardContent>
                    </Card>

                    {/* Sisi Kanan: Ringkasan AI & Rujukan Aktif */}
                    <Card className="lg:col-span-5 border-border bg-card flex flex-col justify-between">
                      <div>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-primary dark:text-indigo-400 flex items-center gap-1.5">
                              <BookOpen className="h-4 w-4" />
                              <span>Ringkasan Konsep AI</span>
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              Terverifikasi
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3 text-xs leading-relaxed">
                          <div className="rounded-lg bg-muted/30 p-3 border border-border/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                Tujuan Triangulasi
                              </span>
                              <button
                                type="button"
                                onClick={() => setHighlightPage((prev) => !prev)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-indigo-400 hover:underline bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                title="Klik untuk menyorot rujukan halaman"
                              >
                                <BookOpen className="h-3 w-3" />
                                <span>Hal. 4</span>
                              </button>
                            </div>
                            <p className="text-muted-foreground">
                              Memastikan konsistensi dan keabsahan temuan riset dengan memadukan lebih dari satu sumber atau metode pengumpulan data.
                            </p>
                          </div>

                          <div className="rounded-lg bg-muted/30 p-3 border border-border/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">
                                Waktu Penerapan
                              </span>
                              <Badge variant="secondary" className="text-xs font-mono">
                                Hal. 5
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">
                              Dilakukan pada tahap verifikasi data sebelum menarik kesimpulan akhir dalam laporan atau tugas akhir.
                            </p>
                          </div>
                        </CardContent>
                      </div>

                      <CardFooter className="pt-3 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Klik tombol{' '}
                          <strong className="text-primary dark:text-indigo-400 font-semibold">Hal. 4</strong>{' '}
                          di atas untuk melihat rujukan
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </CardFooter>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: MANAJEMEN TUGAS */}
              <TabsContent value="tasks" id="showcase-panel-tasks" className="mt-0">
                <div className="max-w-2xl mx-auto">
                  <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="pb-3 border-b border-border">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs font-semibold">
                              MKU204 Metodologi Riset
                            </Badge>
                            <Badge variant="danger" className="text-xs">
                              Prioritas Tinggi
                            </Badge>
                          </div>
                          <CardTitle className="text-base sm:text-lg">
                            Makalah Proposal &amp; Kajian Pustaka
                          </CardTitle>
                        </div>

                        <Badge variant="danger" className="gap-1.5 text-xs py-1 px-2.5 self-start">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Hari ini, 23.59</span>
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-4">
                      {/* Progress Bar Subtugas using shadcn Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium text-muted-foreground">
                          <span>Kemajuan Subtugas</span>
                          <span className="font-mono text-foreground font-semibold tabular-nums">
                            {completedCount} dari {subtasks.length} selesai ({progressPercent}%)
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>

                      {/* Daftar Subtugas Interaktif */}
                      <div
                        className="space-y-2 pt-1"
                        role="group"
                        aria-label="Daftar subtugas makalah"
                      >
                        {subtasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            role="checkbox"
                            aria-checked={task.done}
                            onClick={() => toggleSubtask(task.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/80 hover:bg-muted/30 transition-colors text-left text-xs sm:text-sm touch-manipulation cursor-pointer"
                          >
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                task.done
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-muted-foreground/60 bg-transparent'
                              }`}
                            >
                              {task.done && <CheckCircle2 className="h-3.5 w-3.5" />}
                            </div>
                            <span
                              className={`flex-1 ${
                                task.done
                                  ? 'line-through text-muted-foreground font-normal'
                                  : 'text-foreground font-medium'
                              }`}
                            >
                              {task.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    </CardContent>

                    <CardFooter className="border-t border-border/60 pt-3 justify-center text-xs text-muted-foreground">
                      Klik langsung daftar langkah di atas untuk mencoba perhitungan progres tugas.
                    </CardFooter>
                  </Card>
                </div>
              </TabsContent>

              {/* TAB 3: JADWAL KULIAH */}
              <TabsContent value="schedule" id="showcase-panel-schedule" className="mt-0">
                <div className="space-y-4 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div className="space-y-0.5">
                      <h3 className="text-sm sm:text-base font-bold text-foreground">
                        Jadwal Kuliah Hari Ini — Senin
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Semester Ganjil 2026/2027 • Waktu Indonesia Barat (WIB)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      2 Sesi
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {/* Sesi 1: Sedang Berlangsung */}
                    <Card className="border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="success" className="text-xs gap-1 font-semibold">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Sedang Berlangsung
                            </Badge>
                            <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                              08:00 - 09:40 WIB
                            </span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            MKU204 • 3 SKS
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-bold text-foreground">
                            Metodologi Penelitian Ilmiah
                          </h4>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                              <span>Ruang Kuliah 301 (Gedung Utama Lt. 3)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-primary" />
                              <span>Dr. Hendra Wijaya, M.Si.</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Sesi 2: Mendatang */}
                    <Card className="border-border bg-card shadow-xs">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-semibold">
                              Mendatang
                            </Badge>
                            <span className="text-xs font-mono font-medium text-foreground tabular-nums">
                              13:00 - 15:30 WIB
                            </span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            EKO112 • 3 SKS
                          </span>
                        </div>

                        <div>
                          <h4 className="text-base font-bold text-foreground">
                            Pengantar Ekonomi &amp; Kebijakan Publik
                          </h4>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Ruang Kuliah 402 (Gedung Kuliah Bersama)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Prof. Dr. S. R. Nurhaliza, M.Ec.</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Seluruh jadwal disinkronkan otomatis sesuai zona waktu profil Anda (WIB, WITA, WIT, atau zona lainnya).
                  </p>
                </div>
              </TabsContent>

              {/* TAB 4: FLASHCARD & KUIS */}
              <TabsContent value="quiz" id="showcase-panel-quiz" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                  {/* Kartu Flashcard Interaktif */}
                  <div className="space-y-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        1. Flashcard Pemahaman Konsep
                      </span>
                      <span className="text-xs text-muted-foreground font-mono tabular-nums">
                        Kartu 3 / 15
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsFlipped((prev) => !prev)}
                      className="w-full text-left rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 p-5 sm:p-6 transition-colors duration-150 cursor-pointer min-h-[190px] flex flex-col justify-between group touch-manipulation"
                    >
                      <div className="space-y-2">
                        <Badge variant={isFlipped ? 'success' : 'secondary'} className="text-xs">
                          {isFlipped ? 'Jawaban Konsep' : 'Pertanyaan'}
                        </Badge>
                        <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                          {isFlipped
                            ? 'Data primer dikumpulkan langsung oleh peneliti dari sumber pertama (wawancara atau survei), sedangkan data sekunder berasal dari catatan atau laporan yang sudah tersedia.'
                            : 'Apa perbedaan utama antara data primer dan data sekunder dalam penelitian ilmiah?'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-indigo-400 group-hover:underline pt-3 border-t border-border/40">
                        <RotateCw className="h-3.5 w-3.5" />
                        <span>
                          {isFlipped
                            ? 'Klik untuk kembali ke pertanyaan'
                            : 'Klik kartu untuk membalik jawaban'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Soal Kuis Pilihan Ganda Interaktif */}
                  <div className="space-y-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        2. Kuis Pilihan Ganda
                      </span>
                      <Badge variant="outline" className="text-xs font-mono tabular-nums">
                        Soal 1 / 5
                      </Badge>
                    </div>

                    <Card className="border-border bg-card shadow-xs">
                      <CardContent className="p-4 sm:p-5 space-y-3.5">
                        <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                          Manakah langkah yang paling tepat untuk memastikan keakuratan hasil wawancara lapangan sebelum menyusun kesimpulan?
                        </p>

                        <div
                          className="space-y-2"
                          role="radiogroup"
                          aria-label="Pilihan jawaban kuis"
                        >
                          {[
                            { id: 0, text: 'A) Mengandalkan satu narasumber saja' },
                            { id: 1, text: 'B) Melakukan triangulasi dengan dokumen & observasi' },
                            { id: 2, text: 'C) Mengabaikan data yang berbeda pandangan' },
                            { id: 3, text: 'D) Menulis kesimpulan sebelum verifikasi sumber' },
                          ].map((option) => {
                            const isSelected = quizSelectedOption === option.id;
                            const isCorrect = option.id === 1;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => setQuizSelectedOption(option.id)}
                                className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs sm:text-sm font-medium transition-colors text-left touch-manipulation cursor-pointer ${
                                  isSelected
                                    ? isCorrect
                                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                                      : 'border-destructive bg-destructive/10 text-destructive'
                                    : 'border-border/80 hover:bg-muted/40 text-foreground'
                                }`}
                              >
                                <span>{option.text}</span>
                                {isSelected &&
                                  (isCorrect ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                  ))}
                              </button>
                            );
                          })}
                        </div>

                        {quizSelectedOption !== null && (
                          <div
                            className={`p-3 rounded-lg text-xs leading-relaxed border ${
                              quizSelectedOption === 1
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                                : 'bg-muted/40 border-border text-muted-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-semibold mb-1">
                              <span>Rujukan: Modul Kuliah Hal. 12</span>
                            </div>
                            <span>
                              {quizSelectedOption === 1
                                ? 'Tepat! Triangulasi membandingkan hasil wawancara dengan bukti dokumen maupun observasi agar temuan lebih objektif.'
                                : 'Pilihan belum tepat. Melakukan triangulasi (opsi B) memastikan temuan tervalidasi dari beberapa sumber.'}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </AnimatedPanel>
          </CardContent>
        </Card>
      </Tabs>
    </section>
  );
}
