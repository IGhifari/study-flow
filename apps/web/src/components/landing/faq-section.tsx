'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FadeIn } from '@/components/ui/motion';

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
  return (
    <section id="faq" className="py-14 sm:py-20 border-b border-border/60 scroll-mt-20">
      <FadeIn className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
        <Badge
          variant="secondary"
          className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary dark:text-indigo-400"
        >
          Tanya Jawab
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Pertanyaan yang Sering Diajukan
        </h2>
        <p className="mt-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Semua yang perlu Anda ketahui tentang privasi data akademik, batas format dokumen, dan fitur AI di StudyFlow.
        </p>
      </FadeIn>

      {/* WAI-ARIA disclosure attributes (aria-expanded, aria-controls, role="region") are managed by shadcn Accordion */}
      <Card className="max-w-3xl mx-auto border-border bg-card shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Accordion type="single" collapsible defaultValue="faq-1" className="w-full">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem key={item.id} value={item.id} className="px-4 sm:px-6">
                <AccordionTrigger className="py-4 sm:py-5 text-sm sm:text-base font-semibold text-foreground hover:no-underline">
                  <span className="flex items-center gap-2.5 text-left">
                    <span className="text-xs font-mono text-primary dark:text-indigo-400 font-bold tabular-nums">
                      0{index + 1}
                    </span>
                    <span>{item.question}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <p className="pl-6 border-l-2 border-primary/30">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}
