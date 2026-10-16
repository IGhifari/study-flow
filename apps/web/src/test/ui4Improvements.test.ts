import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Tahap UI-4 Improvements', () => {
  const registerPagePath = path.resolve(__dirname, '../app/(auth)/register/page.tsx');
  const calendarPagePath = path.resolve(__dirname, '../app/(dashboard)/calendar/page.tsx');
  const schedulePagePath = path.resolve(__dirname, '../app/(dashboard)/schedule/page.tsx');
  const createScheduleDialogPath = path.resolve(__dirname, '../components/schedules/create-schedule-dialog.tsx');
  const editScheduleDialogPath = path.resolve(__dirname, '../components/schedules/edit-schedule-dialog.tsx');
  const dialogComponentPath = path.resolve(__dirname, '../components/ui/dialog.tsx');

  it('standardizes registration timezone selector to RadixSelect with react-hook-form integration', () => {
    const registerContent = fs.readFileSync(registerPagePath, 'utf-8');

    // Should NOT use raw <select> tag
    expect(registerContent).not.toMatch(/<select\b/);

    // Should import and use RadixSelect
    expect(registerContent).toContain('RadixSelect as Select');
    expect(registerContent).toContain('<Select');
    expect(registerContent).toContain('<SelectTrigger');
    expect(registerContent).toContain('<SelectValue placeholder="Pilih zona waktu"');
    expect(registerContent).toContain('<SelectContent>');
    expect(registerContent).toContain('<SelectItem');

    // Should synchronize with react-hook-form
    expect(registerContent).toContain("watch('timezone')");
    expect(registerContent).toContain("setValue('timezone', val, { shouldValidate: true })");
  });

  it('standardizes Calendar page toolbar to RadixSelect for semester, course, and type filters', () => {
    const calendarContent = fs.readFileSync(calendarPagePath, 'utf-8');

    // Should NOT import or use NativeSelect
    expect(calendarContent).not.toContain('NativeSelect');

    // Should use RadixSelect
    expect(calendarContent).toContain('RadixSelect as Select');
    expect(calendarContent).toContain('aria-label="Pilih Semester"');
    expect(calendarContent).toContain('aria-label="Filter Mata Kuliah"');
    expect(calendarContent).toContain('aria-label="Filter Tipe Acara"');
    expect(calendarContent).toContain('h-9 text-xs font-medium');
  });

  it('standardizes Schedule page course filter to RadixSelect and includes Reset Filter button', () => {
    const scheduleContent = fs.readFileSync(schedulePagePath, 'utf-8');

    // Should NOT import or use NativeSelect
    expect(scheduleContent).not.toContain('NativeSelect');

    // Should use RadixSelect
    expect(scheduleContent).toContain('RadixSelect as Select');
    expect(scheduleContent).toContain('id="course-filter"');
    expect(scheduleContent).toContain('aria-label="Filter Mata Kuliah"');

    // Should have Reset Filter button when filter is active
    expect(scheduleContent).toContain("selectedCourseFilter !== 'all'");
    expect(scheduleContent).toContain('Reset Filter');
  });

  it('standardizes Course Schedule dialogs to RadixSelect and cleans up micro-typography', () => {
    const createScheduleContent = fs.readFileSync(createScheduleDialogPath, 'utf-8');
    const editScheduleContent = fs.readFileSync(editScheduleDialogPath, 'utf-8');

    expect(createScheduleContent).not.toContain('NativeSelect');
    expect(editScheduleContent).not.toContain('NativeSelect');

    expect(createScheduleContent).toContain('RadixSelect as Select');
    expect(editScheduleContent).toContain('RadixSelect as Select');

    // Micro typography text-[11px] should be cleaned to text-xs
    expect(createScheduleContent).not.toContain('text-[11px]');
    expect(editScheduleContent).not.toContain('text-[11px]');
  });

  it('ensures DialogContent supports responsive scroll containers on mobile viewports', () => {
    const dialogContent = fs.readFileSync(dialogComponentPath, 'utf-8');

    expect(dialogContent).toContain('max-h-[90vh]');
    expect(dialogContent).toContain('overflow-y-auto');
    expect(dialogContent).toContain('max-w-[calc(100vw-2rem)]');
  });
});
