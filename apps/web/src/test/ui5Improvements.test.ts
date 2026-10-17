import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Tahap UI-5 Improvements (Student Portal Feature Pages Standardization)', () => {
  const assignmentsPagePath = path.resolve(__dirname, '../app/(dashboard)/assignments/page.tsx');
  const materialsPagePath = path.resolve(__dirname, '../app/(dashboard)/materials/page.tsx');
  const coursesPagePath = path.resolve(__dirname, '../app/(dashboard)/courses/page.tsx');
  const semestersPagePath = path.resolve(__dirname, '../app/(dashboard)/semesters/page.tsx');
  const notesPagePath = path.resolve(__dirname, '../app/(dashboard)/notes/page.tsx');
  const noteDetailPagePath = path.resolve(__dirname, '../app/(dashboard)/notes/[id]/page.tsx');
  const settingsPagePath = path.resolve(__dirname, '../app/(dashboard)/settings/page.tsx');

  it('standardizes Assignments page with shadcn Table, Progress, and Motion without raw HTML table or micro-typography', () => {
    const content = fs.readFileSync(assignmentsPagePath, 'utf-8');

    expect(content).not.toMatch(/<table\b/);
    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');

    expect(content).toContain('<Table>');
    expect(content).toContain('<TableHeader');
    expect(content).toContain('<TableBody>');
    expect(content).toContain('<Progress');
    expect(content).toContain('FadeIn');
    expect(content).toContain('StaggerGroup');
    expect(content).toContain('StaggerItem');
  });

  it('standardizes Materials page with shadcn Table, Card, tabular-nums, and Motion without raw HTML table or micro-typography', () => {
    const content = fs.readFileSync(materialsPagePath, 'utf-8');

    expect(content).not.toMatch(/<table\b/);
    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');

    expect(content).toContain('<Table>');
    expect(content).toContain('<TableHeader');
    expect(content).toContain('<TableBody>');
    expect(content).toContain('tabular-nums');
    expect(content).toContain('FadeIn');
    expect(content).toContain('StaggerGroup');
    expect(content).toContain('StaggerItem');
  });

  it('standardizes Courses and Semesters pages with shadcn Tabs, separate Desktop Table and Mobile StaggerGroup Card list', () => {
    const coursesContent = fs.readFileSync(coursesPagePath, 'utf-8');
    const semestersContent = fs.readFileSync(semestersPagePath, 'utf-8');

    for (const content of [coursesContent, semestersContent]) {
      expect(content).not.toMatch(/<table\b/);
      expect(content).not.toContain('block md:table');
      expect(content).not.toContain('text-[10px]');
      expect(content).not.toContain('text-[11px]');

      expect(content).toContain('<Tabs');
      expect(content).toContain('<TabsList');
      expect(content).toContain('<TabsTrigger');
      expect(content).toContain('<Table>');
      expect(content).toContain('StaggerGroup');
      expect(content).toContain('StaggerItem');
    }
  });

  it('standardizes Notes list and Note Editor (with Live Split Preview on xl and AnimatedPanel) while preserving optimistic concurrency', () => {
    const notesContent = fs.readFileSync(notesPagePath, 'utf-8');
    const editorContent = fs.readFileSync(noteDetailPagePath, 'utf-8');

    // Notes list page
    expect(notesContent).not.toMatch(/<table\b/);
    expect(notesContent).not.toContain('text-[10px]');
    expect(notesContent).not.toContain('text-[11px]');
    expect(notesContent).toContain('<Table>');
    expect(notesContent).toContain('StaggerGroup');
    expect(notesContent).toContain('StaggerItem');

    // Note detail editor page
    expect(editorContent).not.toContain('text-[10px]');
    expect(editorContent).not.toContain('text-[11px]');
    expect(editorContent).toContain('value="split"');
    expect(editorContent).toContain('Berdampingan');
    expect(editorContent).toContain('AnimatedPanel');
    expect(editorContent).toContain('SafeMarkdownRenderer');

    // Preserve optimistic concurrency and unsaved changes dialog
    expect(editorContent).toContain('NOTE_VERSION_CONFLICT');
    expect(editorContent).toContain('data-testid="unsaved-changes-dialog"');
    expect(editorContent).toContain('data-testid="confirm-save-and-leave"');
    expect(editorContent).toContain('data-testid="confirm-discard-and-leave"');
    expect(editorContent).toContain('data-testid="confirm-stay-and-edit"');
  });

  it('standardizes Settings page storage and quota bars with shadcn Progress and wraps cards in StaggerGroup/StaggerItem', () => {
    const settingsContent = fs.readFileSync(settingsPagePath, 'utf-8');

    expect(settingsContent).toContain('<Progress');
    expect(settingsContent).toContain('tabular-nums');
    expect(settingsContent).toContain('FadeIn');
    expect(settingsContent).toContain('StaggerGroup');
    expect(settingsContent).toContain('StaggerItem');
  });
});
