import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('UI-2 Improvements Static, Accessibility & Interaction Invariant Tests', () => {
  const webDir = path.resolve(__dirname, '..');

  it('1. app-shell.tsx enforces dynamic container width (1440px for material detail, 1200px default)', () => {
    const appShellPath = path.join(webDir, 'components/layout/app-shell.tsx');
    const content = fs.readFileSync(appShellPath, 'utf-8');

    // Dynamic wide page check
    expect(content).toContain("pathname?.startsWith('/materials/') && pathname !== '/materials'");
    expect(content).toContain('max-w-[1440px]');
    expect(content).toContain('max-w-[1200px]');
  });

  it('2. materials/[id]/page.tsx implements Side-by-Side Split View toggle and layout', () => {
    const pagePath = path.join(webDir, 'app/(dashboard)/materials/[id]/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    // Columns2 import and toggle state
    expect(content).toContain('Columns2');
    expect(content).toContain('isSplitView');
    expect(content).toContain('isLargeScreen');
    expect(content).toContain("window.innerWidth >= 1280");

    // Toggle button UI copy
    expect(content).toContain('Tampilan Berdampingan');
    expect(content).toContain('Fokus Satu Panel');
    expect(content).toContain('hidden xl:inline-flex');

    // Split layout grid
    expect(content).toContain('grid grid-cols-1 xl:grid-cols-12 gap-6 items-start');
    expect(content).toContain('xl:col-span-6 xl:sticky xl:top-20');
  });

  it('3. materials/[id]/page.tsx prevents closing active study tab on page jump in split view', () => {
    const pagePath = path.join(webDir, 'app/(dashboard)/materials/[id]/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    // handleJumpToPdfPage condition
    expect(content).toContain('const isSplitActive = isSplitView && isLargeScreen && material?.status === \'READY\';');
    expect(content).toMatch(/if\s*\(!isSplitActive\)\s*\{\s*setActiveTab\('pdf'\);\s*\}/);
  });

  it('4. Dropdown controls in material detail, flashcards, and quiz are standardized to RadixSelect', () => {
    const pagePath = path.join(webDir, 'app/(dashboard)/materials/[id]/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    const flashcardPath = path.join(webDir, 'components/materials/material-flashcard-tab.tsx');
    const flashcardContent = fs.readFileSync(flashcardPath, 'utf-8');
    const quizPath = path.join(webDir, 'components/materials/material-quiz-tab.tsx');
    const quizContent = fs.readFileSync(quizPath, 'utf-8');

    // All should import RadixSelect as Select and subcomponents
    expect(pageContent).toContain('RadixSelect as Select');
    expect(flashcardContent).toContain('RadixSelect as Select');
    expect(quizContent).toContain('RadixSelect as Select');

    // Should NOT use unstyled native <select> for main feature selectors
    expect(pageContent).not.toMatch(/<select\s+value=\{selectedTextPage\}/);
    expect(flashcardContent).not.toMatch(/<select\s+value=\{activeSetId\}/);
    expect(quizContent).not.toMatch(/<select\s+value=\{activeSetId\}/);
  });

  it('5. material-flashcard-tab.tsx provides keyboard shortcuts and helper legend', () => {
    const flashcardPath = path.join(webDir, 'components/materials/material-flashcard-tab.tsx');
    const content = fs.readFileSync(flashcardPath, 'utf-8');

    // Keyboard navigation keys handled
    expect(content).toContain("e.key === 'ArrowLeft'");
    expect(content).toContain("e.key === 'ArrowRight'");
    expect(content).toContain("e.key === '1'");
    expect(content).toContain("e.key === '2'");
    expect(content).toContain("e.key === ' '");
    expect(content).toContain("e.key === 'Enter'");

    // Accessible shortcuts legend
    expect(content).toContain('Pintasan: Spasi (Balik) • ←/→ (Pindah) • 1 (Ulang) • 2 (Paham)');
  });

  it('6. Backend worker jargon and micro typography are eliminated in material UI', () => {
    const pagePath = path.join(webDir, 'app/(dashboard)/materials/[id]/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    const flashcardPath = path.join(webDir, 'components/materials/material-flashcard-tab.tsx');
    const flashcardContent = fs.readFileSync(flashcardPath, 'utf-8');
    const quizPath = path.join(webDir, 'components/materials/material-quiz-tab.tsx');
    const quizContent = fs.readFileSync(quizPath, 'utf-8');

    // No technical worker jargon in user copy
    expect(pageContent).not.toContain('worker background');
    expect(flashcardContent).not.toContain('background worker');
    expect(quizContent).not.toContain('background worker');

    // Improved user-friendly loading copy
    expect(flashcardContent).toContain('Menyusun kartu belajar...');
    expect(quizContent).toContain('Merancang soal kuis...');

    // No micro typography (text-[10px] or text-[11px]) in material views
    expect(pageContent).not.toContain('text-[10px]');
    expect(pageContent).not.toContain('text-[11px]');
    expect(flashcardContent).not.toContain('text-[10px]');
    expect(flashcardContent).not.toContain('text-[11px]');
    expect(quizContent).not.toContain('text-[10px]');
    expect(quizContent).not.toContain('text-[11px]');
  });

  it('7. material-pdf-viewer.tsx supports Fit-Width auto-scaling, zoom presets, and true fullscreen mode', () => {
    const viewerPath = path.join(webDir, 'components/materials/material-pdf-viewer.tsx');
    const content = fs.readFileSync(viewerPath, 'utf-8');

    // Fit-width URL parameter
    expect(content).toContain("zoom === 'fit-width'");
    expect(content).toContain('&view=FitH');
    expect(content).toContain("zoom === 'fit-page'");
    expect(content).toContain('&view=Fit');

    // Zoom dropdown presets
    expect(content).toContain('Pas Lebar');
    expect(content).toContain('Pas Halaman');

    // Fullscreen support
    expect(content).toContain('handleToggleFullscreen');
    expect(content).toContain('requestFullscreen');
    expect(content).toContain('isFullscreen');
  });
});
