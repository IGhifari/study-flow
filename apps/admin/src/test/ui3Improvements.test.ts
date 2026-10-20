import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('UI-3 Improvements: Admin Portal AI Slop & Dead Code Cleanup Tests', () => {
  const adminDir = path.resolve(__dirname, '..');

  it('1. app-sidebar.tsx retains only 3 real operational routes without duplicate/fake navigation', () => {
    const sidebarPath = path.join(adminDir, 'components/app-sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Real navigation routes
    expect(content).toContain('url: "/dashboard"');
    expect(content).toContain('url: "/users"');
    expect(content).toContain('url: "/jobs"');

    // No duplicate or fake navigation groups
    expect(content).not.toContain('navPlatform');
    expect(content).not.toContain('NavDocuments');
    expect(content).not.toContain('Audit Keamanan');
    expect(content).not.toContain('Bantuan & SLA');
  });

  it('2. Dead component and data files are completely removed from monorepo', () => {
    const deadFiles = [
      path.join(adminDir, 'components/nav-documents.tsx'),
      path.join(adminDir, 'components/admin-sidebar.tsx'),
      path.join(adminDir, 'components/site-header.tsx'),
      path.join(adminDir, 'data/platform-services.ts'),
    ];

    for (const filePath of deadFiles) {
      expect(fs.existsSync(filePath), `Dead file ${filePath} must not exist`).toBe(false);
    }
  });

  it('3. section-cards.tsx removes decorative gradients and fake trend arrows', () => {
    const cardsPath = path.join(adminDir, 'components/section-cards.tsx');
    const content = fs.readFileSync(cardsPath, 'utf-8');

    // No decorative gradients on cards
    expect(content).not.toContain('bg-gradient-to-t');
    expect(content).not.toContain('from-primary/5');

    // Consistent neutral card border styling
    expect(content).toContain('border border-border bg-card shadow-xs');

    // No fake trend icons
    expect(content).not.toContain('TrendingUpIcon');
    expect(content).not.toContain('TrendingDownIcon');

    // Semantic status badge for failed jobs (AlertTriangle for attention, CheckCircle2 for normal)
    expect(content).toContain('AlertTriangle');
    expect(content).toContain('CheckCircle2');
    expect(content).toContain('Perlu Perhatian');
    expect(content).toContain('Normal');
  });

  it('4. dashboard/page.tsx eliminates Sparkles badge, animate-bounce, and window.alert()', () => {
    const pagePath = path.join(adminDir, 'app/(dashboard)/dashboard/page.tsx');
    const content = fs.readFileSync(pagePath, 'utf-8');

    // No Sparkles badge or fake version tag
    expect(content).not.toContain('<Sparkles');
    expect(content).not.toContain('v1.0');

    // No animate-bounce on export button
    expect(content).not.toContain('animate-bounce');
    expect(content).toContain('Loader2');

    // No native window.alert dialog
    expect(content).not.toMatch(/alert\s*\(/);
    expect(content).toContain("setExportError('Gagal mengekspor laporan:");
  });

  it('5. data-table.tsx adheres to DESIGN.md §4.2 contrast, eliminates micro typography, and ensures responsive table', () => {
    const tablePath = path.join(adminDir, 'components/data-table.tsx');
    const content = fs.readFileSync(tablePath, 'utf-8');

    // High contrast semantic badges
    expect(content).toContain('bg-success text-success-foreground');
    expect(content).toContain('bg-warning text-warning-foreground');
    expect(content).toContain('border-destructive/20 bg-destructive/10 text-destructive');

    // Responsive horizontal overflow
    expect(content).toContain('overflow-x-auto shadow-xs');

    // No micro typography
    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');
  });

  it('6. apps/admin defines a valid test script and vitest config for CI automated testing', () => {
    const adminRoot = path.resolve(adminDir, '..');
    const pkgPath = path.join(adminRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts?.test).toBeDefined();
    expect(pkg.scripts?.test).toContain('vitest');

    const configPath = path.join(adminRoot, 'vitest.config.ts');
    expect(fs.existsSync(configPath)).toBe(true);
  });
});
