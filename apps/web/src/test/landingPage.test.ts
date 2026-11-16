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

    // 3 Academic Value Pillars (general student-facing copy, free of tech jargon)
    expect(pageContent).toContain('AI Merujuk Sumber Materi Asli');
    expect(pageContent).toContain('Privasi Penuh &amp; Milik Pribadi');
    expect(pageContent).toContain('Sinkronisasi Zona Waktu Lokal');
    expect(pageContent).not.toMatch(/PostgreSQL|Supabase|Redis|BullMQ|BENTO/i);
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
    expect(showcaseContent).toContain('Makalah Proposal &amp; Kajian Pustaka');
    expect(showcaseContent).toContain('Hari ini, 23.59');
    expect(showcaseContent).toContain('Kumpulkan minimal 5 jurnal rujukan utama');
    expect(showcaseContent).toContain('toggleSubtask');

    // Tab 3: Lecture schedule
    expect(showcaseContent).toContain('Metodologi Penelitian Ilmiah');
    expect(showcaseContent).toContain('08:00 - 09:40 WIB');
    expect(showcaseContent).toContain('Sedang Berlangsung');

    // Tab 4: Flashcard & Multiple choice quiz
    expect(showcaseContent).toContain('isFlipped');
    expect(showcaseContent).toContain('data primer dan data sekunder');
    expect(showcaseContent).toContain('triangulasi dengan dokumen');
    expect(showcaseContent).toContain('Rujukan: Modul Kuliah Hal. 12');
    expect(showcaseContent).not.toMatch(/PostgreSQL|Supabase|Redis|BullMQ|3NF|Dijkstra|Min-Heap/i);
  });

  it('implements accessible FaqSection with 5 required questions and answers without infra jargon', () => {
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

    // Answers general copy & absence of infra names
    expect(faqContent).toContain('tersimpan aman serta hanya dapat diakses melalui akun pribadi Anda');
    expect(faqContent).not.toMatch(/PostgreSQL|Supabase|Redis|BullMQ|storage privat/i);
    expect(faqContent).toContain('maksimal 20 MB dan 100 halaman per berkas');
    expect(faqContent).toContain('20 pembuatan ringkasan, flashcard, atau kuis AI per hari');
    expect(faqContent).toContain('menyertakan nomor halaman dokumen sumber asli');
    expect(faqContent).toContain('WIB, WITA, WIT');
  });

  it('integrates Motion primitives, next/image SVG illustrations, and full shadcn/ui primitives across landing page and dashboard', () => {
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    const showcaseContent = fs.readFileSync(showcasePath, 'utf-8');
    const faqContent = fs.readFileSync(faqPath, 'utf-8');
    const motionPath = path.resolve(__dirname, '../components/ui/motion.tsx');
    const dashboardContentPath = path.resolve(__dirname, '../app/(dashboard)/dashboard/dashboard-content.tsx');
    const imagesDir = path.resolve(__dirname, '../../public/images');

    // Motion primitive respects prefers-reduced-motion
    const motionContent = fs.readFileSync(motionPath, 'utf-8');
    expect(motionContent).toContain("from 'motion/react'");
    expect(motionContent).toContain('useReducedMotion');
    expect(motionContent).toContain('FadeIn');
    expect(motionContent).toContain('StaggerGroup');
    expect(motionContent).toContain('StaggerItem');
    expect(motionContent).toContain('AnimatedPanel');

    // 4 SVG illustrations exist
    expect(fs.existsSync(path.join(imagesDir, 'hero-studyflow-workspace.svg'))).toBe(true);
    expect(fs.existsSync(path.join(imagesDir, 'feature-pdf-citation.svg'))).toBe(true);
    expect(fs.existsSync(path.join(imagesDir, 'feature-semester-schedule.svg'))).toBe(true);
    expect(fs.existsSync(path.join(imagesDir, 'feature-flashcard-quiz.svg'))).toBe(true);

    // Landing page uses next/image, Card, Badge, and Motion
    expect(pageContent).toContain("from 'next/image'");
    expect(pageContent).toContain('/images/hero-studyflow-workspace.svg');
    expect(pageContent).toContain('/images/feature-pdf-citation.svg');
    expect(pageContent).toContain('/images/feature-semester-schedule.svg');
    expect(pageContent).toContain('/images/feature-flashcard-quiz.svg');
    expect(pageContent).toContain('<FadeIn');
    expect(pageContent).toContain('<StaggerGroup');
    expect(pageContent).toContain('<Card');

    // Product showcase uses Tabs, Card, Progress, and AnimatedPanel
    expect(showcaseContent).toContain("from '@/components/ui/tabs'");
    expect(showcaseContent).toContain("from '@/components/ui/progress'");
    expect(showcaseContent).toContain('<AnimatedPanel');

    // FAQ section uses Accordion and Card
    expect(faqContent).toContain("from '@/components/ui/accordion'");
    expect(faqContent).toContain('<Accordion');

    // Dashboard uses Card, Tabs, Progress, Table, and Motion
    const dashboardContent = fs.readFileSync(dashboardContentPath, 'utf-8');
    expect(dashboardContent).toContain("from '@/components/ui/card'");
    expect(dashboardContent).toContain("from '@/components/ui/tabs'");
    expect(dashboardContent).toContain("from '@/components/ui/progress'");
    expect(dashboardContent).toContain("from '@/components/ui/table'");
    expect(dashboardContent).toContain("from '@/components/ui/motion'");
  });
});

