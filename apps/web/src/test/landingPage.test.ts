import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Public Landing Page Production Overhaul', () => {
  const pagePath = path.resolve(__dirname, '../app/page.tsx');
  const mobileNavPath = path.resolve(__dirname, '../components/landing/public-mobile-nav.tsx');
  const showcasePath = path.resolve(__dirname, '../components/landing/product-showcase.tsx');
  const faqPath = path.resolve(__dirname, '../components/landing/faq-section.tsx');

  it('integrates PublicMobileNav, ProductShowcase, FaqSection, and 3 academic pillars in page.tsx', () => {
    const pageContent = fs.readFileSync(pagePath, 'utf-8');

    // Component integrations
    expect(pageContent).toContain('PublicMobileNav');
    expect(pageContent).toContain('<ProductShowcase />');
    expect(pageContent).toContain('<FaqSection />');

    // Navigation links in header and footer
    expect(pageContent).toContain('href="#fitur"');
    expect(pageContent).toContain('href="#cara-kerja"');
    expect(pageContent).toContain('href="#faq"');

    // 3 Academic Value Pillars
    expect(pageContent).toContain('Verifiable AI (Bukan Chatbot Halusinasi)');
    expect(pageContent).toContain('Privasi Penuh & Data Terisolasi');
    expect(pageContent).toContain('Sinkronisasi Zona Waktu Nyata');
  });

  it('implements responsive mobile drawer navigation in public-mobile-nav.tsx', () => {
    const navContent = fs.readFileSync(mobileNavPath, 'utf-8');

    // Uses Sheet primitive
    expect(navContent).toContain("from '@/components/ui/sheet'");
    expect(navContent).toContain('<Sheet');
    expect(navContent).toContain('<SheetTrigger');
    expect(navContent).toContain('<SheetContent');

    // Accessible trigger with Menu icon
    expect(navContent).toContain('aria-label="Buka menu navigasi"');
    expect(navContent).toContain('md:hidden');
    expect(navContent).toContain('touch-manipulation');

    // Links and theme toggle
    expect(navContent).toContain('href="#fitur"');
    expect(navContent).toContain('href="#cara-kerja"');
    expect(navContent).toContain('href="#faq"');
    expect(navContent).toContain('<ThemeToggle />');

    // Auth actions
    expect(navContent).toContain('/dashboard');
    expect(navContent).toContain('/register');
    expect(navContent).toContain('/login');
  });

  it('implements real interactive ProductShowcase with 4 academic tabs', () => {
    const showcaseContent = fs.readFileSync(showcasePath, 'utf-8');

    // 4 feature tabs
    expect(showcaseContent).toContain('Pembaca PDF & Rujukan');
    expect(showcaseContent).toContain('Manajemen Tugas');
    expect(showcaseContent).toContain('Jadwal Kuliah');
    expect(showcaseContent).toContain('Flashcard & Kuis');

    // Tab 1: PDF Reader and page reference
    expect(showcaseContent).toContain('Halaman 4 / 28');
    expect(showcaseContent).toContain('Hal. 4');
    expect(showcaseContent).toContain('Ringkasan Konsep AI');

    // Tab 2: Task with checklist
    expect(showcaseContent).toContain('Laporan Praktikum Basis Data');
    expect(showcaseContent).toContain('Hari ini, 23.59');
    expect(showcaseContent).toContain('Normalisasi relasi tabel hingga bentuk 3NF');
    expect(showcaseContent).toContain('toggleSubtask');

    // Tab 3: Lecture schedule
    expect(showcaseContent).toContain('Struktur Data & Algoritma');
    expect(showcaseContent).toContain('08:00 - 09:40 WIB');
    expect(showcaseContent).toContain('Sedang Berlangsung');

    // Tab 4: Flashcard & Multiple choice quiz
    expect(showcaseContent).toContain('isFlipped');
    expect(showcaseContent).toContain('Balanced Binary Search Tree');
    expect(showcaseContent).toContain('Dijkstra');
    expect(showcaseContent).toContain('Min-Heap / Binary Heap');
    expect(showcaseContent).toContain('Rujukan: Slide Kuliah Hal. 12');
  });

  it('implements accessible FaqSection with 5 required questions and answers', () => {
    const faqContent = fs.readFileSync(faqPath, 'utf-8');

    // Section anchor
    expect(faqContent).toContain('id="faq"');
    expect(faqContent).toContain('scroll-mt-20');

    // WAI-ARIA disclosure attributes
    expect(faqContent).toContain('aria-expanded');
    expect(faqContent).toContain('aria-controls');
    expect(faqContent).toContain('role="region"');

    // Q1 - Q5
    expect(faqContent).toContain('Apakah data dokumen materi kuliah dan catatan saya aman dan privat?');
    expect(faqContent).toContain('Format dan batasan dokumen materi apa saja yang didukung?');
    expect(faqContent).toContain('Apakah fitur ringkasan, flashcard, dan kuis AI memerlukan biaya atau kartu kredit?');
    expect(faqContent).toContain('Bagaimana cara kerja rujukan halaman AI di StudyFlow?');
    expect(faqContent).toContain('Apakah jadwal kuliah dan tenggat tugas mendukung zona waktu lokal saya?');

    // Answers verbatim verification
    expect(faqContent).toContain('tersimpan terisolasi per akun pengguna di database PostgreSQL dan storage privat');
    expect(faqContent).toContain('maksimal 20 MB dan 100 halaman per berkas');
    expect(faqContent).toContain('20 generasi AI per hari');
    expect(faqContent).toContain('menyertakan nomor halaman dokumen sumber asli');
    expect(faqContent).toContain('WIB, WITA, WIT');
  });
});
