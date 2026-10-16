'use client';

import * as React from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'Apakah data dokumen materi kuliah dan catatan saya aman dan privat?',
    answer:
      'Ya, seluruh dokumen PDF dan catatan perkuliahan tersimpan terisolasi per akun pengguna di database PostgreSQL dan storage privat. Data akademik Anda tidak pernah dijual, dibagikan, atau digunakan untuk melatih model AI publik.',
  },
  {
    id: 'faq-2',
    question: 'Format dan batasan dokumen materi apa saja yang didukung?',
    answer:
      'StudyFlow mendukung dokumen PDF perkuliahan berbasis teks hingga ukuran maksimal 20 MB dan 100 halaman per berkas.',
  },
  {
    id: 'faq-3',
    question: 'Apakah fitur ringkasan, flashcard, dan kuis AI memerlukan biaya atau kartu kredit?',
    answer:
      'Tidak. StudyFlow memanfaatkan kuota harian terukur (20 generasi AI per hari) yang dapat digunakan tanpa memasukkan kartu kredit atau biaya langganan.',
  },
  {
    id: 'faq-4',
    question: 'Bagaimana cara kerja rujukan halaman AI di StudyFlow?',
    answer:
      'Berbeda dari chatbot umum yang dapat berhalusinasi, setiap ringkasan konsep, kartu belajar, dan pembahasan kuis di StudyFlow menyertakan nomor halaman dokumen sumber asli, sehingga Anda dapat langsung memverifikasi kebenaran materi pada slide atau modul kuliah.',
  },
  {
    id: 'faq-5',
    question: 'Apakah jadwal kuliah dan tenggat tugas mendukung zona waktu lokal saya?',
    answer:
      'Ya. StudyFlow mendukung seluruh zona waktu Indonesia (WIB, WITA, WIT) serta UTC standar yang dapat Anda atur pada profil akun.',
  },
];

export function FaqSection(): React.JSX.Element {
  // Buka FAQ pertama secara default untuk memberi contoh visual
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({
    'faq-1': true,
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section id="faq" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
      <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
        <Badge variant="outline" className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
          Tanya Jawab
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Pertanyaan yang Sering Diajukan
        </h2>
        <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Semua yang perlu Anda ketahui tentang privasi data akademik, batas format dokumen, dan fitur AI di StudyFlow.
        </p>
      </div>

      <div className="max-w-3xl mx-auto divide-y divide-border rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = Boolean(openItems[item.id]);
          const contentId = `faq-content-${item.id}`;
          const buttonId = `faq-trigger-${item.id}`;

          return (
            <div key={item.id} className="transition-colors">
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => toggleItem(item.id)}
                  className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-primary font-bold">
                      0{index + 1}
                    </span>
                    <span>{item.question}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out ${
                      isOpen ? 'rotate-180 text-primary' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </h3>

              {isOpen && (
                <div
                  id={contentId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed"
                >
                  <p className="pl-6 border-l-2 border-primary/30">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
