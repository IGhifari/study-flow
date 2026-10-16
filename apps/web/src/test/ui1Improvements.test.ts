import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('UI-1 Improvements Static & Accessibility Invariant Tests', () => {
  const webDir = path.resolve(__dirname, '..');

  it('1. globals.css declares Tailwind CSS v4 dark mode variant', () => {
    const cssPath = path.join(webDir, 'app/globals.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('@import "tailwindcss";');
    expect(cssContent).toMatch(/@custom-variant\s+dark\s+\(&:is\(\.dark\s+\*\)\);/);
  });

  it('2. app-shell.tsx includes Skip to Content link and main content landmark', () => {
    const appShellPath = path.join(webDir, 'components/layout/app-shell.tsx');
    const appShellContent = fs.readFileSync(appShellPath, 'utf-8');

    // Skip to content link
    expect(appShellContent).toContain('href="#main-content"');
    expect(appShellContent).toContain('Lewati ke konten utama');
    expect(appShellContent).toContain('sr-only focus:not-sr-only');

    // Target main landmark
    expect(appShellContent).toMatch(/<main[^>]*id="main-content"[^>]*>/);
  });

  it('3. dashboard-content.tsx decouples task title click from checkbox selection', () => {
    const dashPath = path.join(webDir, 'app/(dashboard)/dashboard/dashboard-content.tsx');
    const dashContent = fs.readFileSync(dashPath, 'utf-8');

    // Should NOT have label wrapping task title with htmlFor
    expect(dashContent).not.toMatch(/<label[^>]*htmlFor=\{`task-\$\{asg\.id\}`\}/);

    // Should have Link to /assignments for task title
    expect(dashContent).toContain('href="/assignments"');

    // Checkbox should still retain its id and accessible aria-label
    expect(dashContent).toContain('id={`task-${asg.id}`}');
    expect(dashContent).toContain('aria-label={`Tandai tugas ${asg.title} sebagai');
  });

  it('4. dashboard-content.tsx enforces tabular-nums on metrics and dates', () => {
    const dashPath = path.join(webDir, 'app/(dashboard)/dashboard/dashboard-content.tsx');
    const dashContent = fs.readFileSync(dashPath, 'utf-8');

    // Header date
    expect(dashContent).toContain('className="tabular-nums">{todayFormatted}</span>');

    // Stats strip
    expect(dashContent).toContain('text-foreground tabular-nums">\n                {summary.assignmentsToday.length}');
    expect(dashContent).toContain('tabular-nums ${');
    expect(dashContent).toContain('text-foreground tabular-nums">\n                {summary.completedCount}');
    expect(dashContent).toContain('className="text-xs text-muted-foreground tabular-nums">');

    // Task items date and subtask count
    expect(dashContent).toContain('<span className="tabular-nums">{formatUserDateTime(asg.dueDate, timezone)}</span>');
    expect(dashContent).toContain('<span className="tabular-nums">\n                                          {asg.subtaskCount.completed}/{asg.subtaskCount.total}');
  });

  it('5. dashboard-content.tsx places DashboardCharts at the bottom below recent materials', () => {
    const dashPath = path.join(webDir, 'app/(dashboard)/dashboard/dashboard-content.tsx');
    const dashContent = fs.readFileSync(dashPath, 'utf-8');

    const recentMaterialsIndex = dashContent.indexOf('Materi Terbaru');
    const chartsIndex = dashContent.indexOf('<DashboardCharts');
    const gridTasksIndex = dashContent.indexOf('Tugas Terdekat');

    expect(recentMaterialsIndex).toBeGreaterThan(-1);
    expect(chartsIndex).toBeGreaterThan(-1);
    expect(gridTasksIndex).toBeGreaterThan(-1);

    // Tasks and Recent Materials must be above DashboardCharts
    expect(chartsIndex).toBeGreaterThan(recentMaterialsIndex);
    expect(chartsIndex).toBeGreaterThan(gridTasksIndex);
  });
});
