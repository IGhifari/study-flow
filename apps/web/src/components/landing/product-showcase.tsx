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
  HelpCircle,
  RotateCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  MapPin,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ShowcaseTab = 'pdf' | 'tasks' | 'schedule' | 'quiz';

export function ProductShowcase(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<ShowcaseTab>('pdf');

  // Interactive states for Tab 1 (PDF)
  const [highlightPage, setHighlightPage] = React.useState<boolean>(false);

  // Interactive states for Tab 2 (Tasks)
  const [subtasks, setSubtasks] = React.useState<Array<{ id: number; text: string; done: boolean }>>([
    { id: 1, text: 'Normalisasi relasi tabel hingga bentuk 3NF', done: true },
    { id: 2, text: 'Implementasi skema DDL & batasan foreign key', done: true },
    { id: 3, text: 'Penyusunan diagram ERD dan laporan pengujian', done: false },
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

  const tabs: Array<{ id: ShowcaseTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'pdf', label: 'Pembaca PDF & Rujukan', icon: BookOpen },
    { id: 'tasks', label: 'Manajemen Tugas', icon: ListTodo },
    { id: 'schedule', label: 'Jadwal Kuliah', icon: CalendarClock },
    { id: 'quiz', label: 'Flashcard & Kuis', icon: Layers },
  ];

  return (
    <section className="py-12 sm:py-16 border-b border-border/60">
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <Badge variant="outline" className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
          Antarmuka Produk Nyata
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Dirancang untuk Fokus Belajar Tanpa Distraksi
        </h2>
        <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Eksplorasi cuplikan interaktif di bawah untuk melihat bagaimana StudyFlow membantu perkuliahan Anda setiap hari.
        </p>
      </div>

      {/* Tabs Selector Bar */}
      <div className="flex justify-center mb-6">
        <div
          role="tablist"
          aria-label="Pilih fitur pratinjau StudyFlow"
          className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border max-w-full"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`showcase-panel-${tab.id}`}
                id={`showcase-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                  isActive
                    ? 'bg-card text-foreground font-semibold shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Showcase Panel */}
      <div
        role="tabpanel"
        id={`showcase-panel-${activeTab}`}
        aria-labelledby={`showcase-tab-${activeTab}`}
        className="rounded-2xl border border-border bg-card p-4 sm:p-6 lg:p-8 shadow-xs"
      >
        {/* TAB 1: PDF & RUJUKAN HALAMAN */}
        {activeTab === 'pdf' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border text-xs">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate max-w-[280px] sm:max-w-md">
                  Slide_Kuliah_Bab4_Algoritma_Graf_Lintasan_Terpendek.pdf
                </span>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                  highlightPage ? 'bg-primary text-primary-foreground font-bold animate-pulse' : 'bg-muted text-muted-foreground'
                }`}>
                  Halaman 4 / 28
                </span>
                <span className="text-muted-foreground hidden sm:inline">• 100% Zoom</span>
              </div>
            </div>

            {/* Split View Simulation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-[340px]">
              {/* Sisi Kiri: Cuplikan Halaman PDF */}
              <div
                className={`lg:col-span-7 rounded-xl border p-4 sm:p-5 transition-all duration-300 ${
                  highlightPage
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      Slide Perkuliahan — Hal. 4
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      IF2211 Struktur Data
                    </Badge>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-foreground">
                    4.2 Algoritma Dijkstra (Single-Source Shortest Path)
                  </h4>
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                    Algoritma Dijkstra menemukan lintasan dengan bobot minimum dari suatu simpul asal <em>s</em> ke semua simpul lain dalam graf berarah dengan bobot sisi bernilai non-negatif:
                  </p>
                  <div className="rounded-lg bg-card border border-border p-3 font-mono text-xs text-foreground space-y-1">
                    <div className="text-primary font-semibold">{'// Inisialisasi jarak simpul'}</div>
                    <div>dist[s] = 0; dist[v] = ∞ untuk setiap v ≠ s;</div>
                    <div>PQ.insert(s, 0);</div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>Invarian Kunci:</strong> Setiap simpul yang diekstrak dari antrean prioritas telah memiliki jarak minimum absolut yang tidak akan berubah lagi.
                  </p>
                </div>
              </div>

              {/* Sisi Kanan: Ringkasan AI & Rujukan Aktif */}
              <div className="lg:col-span-5 rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Ringkasan Konsep AI</span>
                    </div>
                    <Badge variant="outline" className="text-[11px]">Terverifikasi</Badge>
                  </div>

                  <div className="space-y-3 text-xs leading-relaxed">
                    <div className="rounded-lg bg-muted/30 p-3 border border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Karakteristik Dijkstra</span>
                        <button
                          type="button"
                          onClick={() => setHighlightPage((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                          title="Klik untuk menyorot rujukan halaman"
                        >
                          <BookOpen className="h-3 w-3" />
                          <span>Hal. 4</span>
                        </button>
                      </div>
                      <p className="text-muted-foreground">
                        Hanya bekerja pada graf dengan bobot non-negatif. Menggunakan struktur min-heap untuk efisiensi pemilihan simpul terdekat berikutnya.
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/30 p-3 border border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Kompleksitas Waktu</span>
                        <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          Hal. 5
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        O((V + E) log V) bila diimplementasikan dengan binary heap dan adjacency list standar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/80 mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>💡 Klik badge <strong className="text-primary font-semibold">Hal. 4</strong> di atas untuk melihat rujukan</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANAJEMEN TUGAS */}
        {activeTab === 'tasks' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      IF2102 Sistem Basis Data
                    </Badge>
                    <Badge variant="danger" className="text-xs">
                      Prioritas Tinggi
                    </Badge>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Laporan Praktikum Basis Data
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-danger self-start sm:self-auto bg-danger/10 px-2.5 py-1 rounded-md">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Hari ini, 23.59</span>
                </div>
              </div>

              {/* Progress Bar Subtugas */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Kemajuan Subtugas</span>
                  <span className="font-mono text-foreground font-semibold">
                    {completedCount} dari {subtasks.length} selesai ({progressPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Daftar Subtugas Interaktif */}
              <div className="space-y-2 pt-1" role="group" aria-label="Daftar subtugas praktikum">
                {subtasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    role="checkbox"
                    aria-checked={task.done}
                    onClick={() => toggleSubtask(task.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/80 hover:bg-muted/30 transition-colors text-left text-xs sm:text-sm touch-manipulation"
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

              <p className="text-xs text-muted-foreground text-center pt-2">
                👆 Anda dapat mencentang langsung checklist di atas untuk menguji interaktivitas tugas.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: JADWAL KULIAH */}
        {activeTab === 'schedule' && (
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
              <Badge variant="outline" className="text-xs">2 Sesi</Badge>
            </div>

            <div className="space-y-3">
              {/* Sesi 1: Sedang Berlangsung */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-xs gap-1 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-100 animate-pulse" />
                      Sedang Berlangsung
                    </Badge>
                    <span className="text-xs font-mono font-medium text-foreground">
                      08:00 - 09:40 WIB
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">IF2211 • 3 SKS</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-foreground">
                    Struktur Data & Algoritma
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>Lab Komputer 3 (Gedung B Lt. 2)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>Dr. Eng. Hendra Wijaya</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sesi 2: Mendatang */}
              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      Mendatang
                    </Badge>
                    <span className="text-xs font-mono font-medium text-foreground">
                      13:00 - 15:30 WIB
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">IF3140 • 3 SKS</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-foreground">
                    Kecerdasan Buatan & Sistem Pakar
                  </h4>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Ruang Kuliah 402 (Gedung Kuliah Bersama)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Prof. Dr. Ir. S. R. Nurhaliza</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              📅 Seluruh jadwal disinkronkan otomatis sesuai zona waktu profil (WIB, WITA, WIT, atau UTC).
            </p>
          </div>
        )}

        {/* TAB 4: FLASHCARD & KUIS */}
        {activeTab === 'quiz' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Kartu Flashcard Interaktif */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  1. Flashcard Pemahaman Konsep
                </span>
                <span className="text-xs text-muted-foreground font-mono">Kartu 3 / 15</span>
              </div>

              <button
                type="button"
                onClick={() => setIsFlipped((prev) => !prev)}
                className="w-full text-left rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 p-5 sm:p-6 transition-all duration-200 cursor-pointer min-h-[190px] flex flex-col justify-between group touch-manipulation"
              >
                <div className="space-y-2">
                  <Badge variant={isFlipped ? 'success' : 'secondary'} className="text-[11px]">
                    {isFlipped ? 'Jawaban Konsep' : 'Pertanyaan'}
                  </Badge>
                  <p className="text-sm sm:text-base font-semibold text-foreground leading-relaxed">
                    {isFlipped
                      ? 'O(log n). Struktur pohon yang seimbang memastikan tinggi pohon maksimal sebanding dengan logaritma basis 2 dari jumlah simpul, sehingga penelusuran selalu efisien.'
                      : 'Berapa kompleksitas waktu rata-rata operasi pencarian pada struktur data Balanced Binary Search Tree (AVL / Red-Black Tree)?'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:underline pt-3 border-t border-border/40">
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>{isFlipped ? 'Klik untuk kembali ke pertanyaan' : 'Klik kartu untuk membalik jawaban'}</span>
                </div>
              </button>
            </div>

            {/* Soal Kuis Pilihan Ganda Interaktif */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  2. Kuis Pilihan Ganda
                </span>
                <Badge variant="outline" className="text-xs font-mono">Soal 1 / 5</Badge>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-xs">
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                  Manakah struktur data yang paling efisien untuk implementasi antrean prioritas pada algoritma Dijkstra?
                </p>

                <div className="space-y-2" role="radiogroup" aria-label="Pilihan jawaban kuis">
                  {[
                    { id: 0, text: 'A) Array Terurut (Sorted Array)' },
                    { id: 1, text: 'B) Min-Heap / Binary Heap' },
                    { id: 2, text: 'C) Singly Linked List' },
                    { id: 3, text: 'D) Stack LIFO' },
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
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs sm:text-sm font-medium transition-colors text-left touch-manipulation ${
                          isSelected
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                              : 'border-destructive bg-destructive/10 text-destructive'
                            : 'border-border/80 hover:bg-muted/40 text-foreground'
                        }`}
                      >
                        <span>{option.text}</span>
                        {isSelected && (
                          isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          )
                        )}
                      </button>
                    );
                  })}
                </div>

                {quizSelectedOption !== null && (
                  <div className={`p-3 rounded-lg text-xs leading-relaxed border ${
                    quizSelectedOption === 1
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
                      : 'bg-muted/40 border-border text-muted-foreground'
                  }`}>
                    <div className="flex items-center gap-1.5 font-semibold mb-1">
                      <span>Rujukan: Slide Kuliah Hal. 12</span>
                    </div>
                    <span>
                      {quizSelectedOption === 1
                        ? 'Tepat! Min-Heap memungkinkan operasi extract-min dalam kompleksitas O(log V).'
                        : 'Pilihan belum tepat. Min-Heap (opsi B) adalah struktur data standar yang paling efisien.'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
