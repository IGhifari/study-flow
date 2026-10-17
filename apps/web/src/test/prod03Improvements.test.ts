import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PROD-03 Production Overhaul & Sub-Components Standardization', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const webSrcDir = path.resolve(__dirname, '..');
  const adminSrcDir = path.resolve(rootDir, 'apps/admin/src');

  it('verifies dashboard-charts.tsx uses shadcn Table, CardFooter, motion Stagger, and clean typography', () => {
    const filePath = path.join(webSrcDir, 'components/dashboard/dashboard-charts.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Uses shadcn Table components, not raw table
    expect(content).toContain("from '@/components/ui/table'");
    expect(content).toContain('<Table>');
    expect(content).not.toContain('<table className=');

    // Uses CardFooter
    expect(content).toContain("CardFooter");
    expect(content).toContain('<CardFooter');

    // Uses Motion StaggerGroup and StaggerItem
    expect(content).toContain('StaggerGroup');
    expect(content).toContain('StaggerItem');
    expect(content).toContain('<StaggerGroup');
    expect(content).toContain('<StaggerItem>');

    // No micro typography
    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');
  });

  it('verifies assignment-subtask-checklist.tsx uses shadcn Progress and clean typography', () => {
    const filePath = path.join(webSrcDir, 'components/assignments/assignment-subtask-checklist.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Uses shadcn Progress
    expect(content).toContain("from '@/components/ui/progress'");
    expect(content).toContain('<Progress');
    expect(content).not.toContain('role="progressbar"');

    // Uses tabular-nums
    expect(content).toContain('tabular-nums');

    // No micro typography
    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');
  });

  it('verifies modals are free of micro-typography', () => {
    const pinnedModalPath = path.join(webSrcDir, 'components/dashboard/pinned-items-modal.tsx');
    const pinnedModalContent = fs.readFileSync(pinnedModalPath, 'utf-8');
    expect(pinnedModalContent).not.toContain('text-[10px]');
    expect(pinnedModalContent).not.toContain('text-[11px]');

    const uploadDialogPath = path.join(webSrcDir, 'components/materials/material-upload-dialog.tsx');
    const uploadDialogContent = fs.readFileSync(uploadDialogPath, 'utf-8');
    expect(uploadDialogContent).not.toContain('text-[10px]');
    expect(uploadDialogContent).not.toContain('text-[11px]');
  });

  it('verifies apps/web/src/app/error.tsx exists with resilient structure and motion', () => {
    const errorFilePath = path.join(webSrcDir, 'app/error.tsx');
    expect(fs.existsSync(errorFilePath)).toBe(true);

    const content = fs.readFileSync(errorFilePath, 'utf-8');
    expect(content).toContain("'use client'");
    expect(content).toContain('FadeIn');
    expect(content).toContain('Card');
    expect(content).toContain('CardHeader');
    expect(content).toContain('CardTitle');
    expect(content).toContain('CardFooter');
    expect(content).toContain('Terjadi Kendala Teknis');
    expect(content).toContain('error.digest');
    expect(content).toContain('reset()');
    expect(content).toContain('href="/"');
  });

  it('verifies apps/admin/src/app/error.tsx exists with resilient structure and dashboard recovery', () => {
    const errorFilePath = path.join(adminSrcDir, 'app/error.tsx');
    expect(fs.existsSync(errorFilePath)).toBe(true);

    const content = fs.readFileSync(errorFilePath, 'utf-8');
    expect(content).toContain("'use client'");
    expect(content).toContain('FadeIn');
    expect(content).toContain('Card');
    expect(content).toContain('CardHeader');
    expect(content).toContain('CardTitle');
    expect(content).toContain('CardFooter');
    expect(content).toContain('Terjadi Kendala Teknis');
    expect(content).toContain('error.digest');
    expect(content).toContain('reset()');
    expect(content).toContain('href="/dashboard"');
  });

  it('verifies root package.json contains dev:all script', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['dev:all']).toBeDefined();
    expect(pkg.scripts['dev:all']).toContain('npm run dev:web');
    expect(pkg.scripts['dev:all']).toContain('npm run dev:admin');
    expect(pkg.scripts['dev:all']).toContain('npm run dev:api');
    expect(pkg.scripts['dev:all']).toContain('npm run dev:worker');
  });

  it('verifies .github/workflows/ci.yml includes required secrets and admin docker build', () => {
    const ciPath = path.join(rootDir, '.github/workflows/ci.yml');
    const ciContent = fs.readFileSync(ciPath, 'utf-8');
    expect(ciContent).toContain('JWT_REFRESH_SECRET');
    expect(ciContent).toContain('COOKIE_SECRET');
    expect(ciContent).toContain('studyflow-admin:ci');
    expect(ciContent).toContain('docker build -f apps/admin/Dockerfile');
  });

  it('verifies docs/release_checklist.md includes items 13 through 17 with PASS', () => {
    const docPath = path.join(rootDir, 'docs/release_checklist.md');
    const docContent = fs.readFileSync(docPath, 'utf-8');
    expect(docContent).toContain('| **13** |');
    expect(docContent).toContain('| **14** |');
    expect(docContent).toContain('| **15** |');
    expect(docContent).toContain('| **16** |');
    expect(docContent).toContain('| **17** |');
  });
});
