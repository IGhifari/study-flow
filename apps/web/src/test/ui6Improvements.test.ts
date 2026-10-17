import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Tahap UI-6 Improvements (Final UI/UX Polish Across Student & Admin Portals)', () => {
  const courseDetailPagePath = path.resolve(__dirname, '../app/(dashboard)/courses/[id]/page.tsx');
  const schedulePagePath = path.resolve(__dirname, '../app/(dashboard)/schedule/page.tsx');
  const calendarPagePath = path.resolve(__dirname, '../app/(dashboard)/calendar/page.tsx');
  const monthViewPath = path.resolve(__dirname, '../components/calendar/month-view.tsx');
  const weekViewPath = path.resolve(__dirname, '../components/calendar/week-view.tsx');
  const agendaViewPath = path.resolve(__dirname, '../components/calendar/agenda-view.tsx');
  const dayEventsDialogPath = path.resolve(__dirname, '../components/calendar/day-events-dialog.tsx');
  const eventDetailDialogPath = path.resolve(__dirname, '../components/calendar/event-detail-dialog.tsx');
  const globalSearchDialogPath = path.resolve(__dirname, '../components/search/global-search-dialog.tsx');

  const webLoginPagePath = path.resolve(__dirname, '../app/(auth)/login/page.tsx');
  const webRegisterPagePath = path.resolve(__dirname, '../app/(auth)/register/page.tsx');
  const webForgotPasswordPagePath = path.resolve(__dirname, '../app/(auth)/forgot-password/page.tsx');
  const webResetPasswordPagePath = path.resolve(__dirname, '../app/(auth)/reset-password/page.tsx');
  const webVerifyEmailClientPath = path.resolve(__dirname, '../app/(auth)/verify-email/verify-email-client.tsx');
  const webNotFoundPagePath = path.resolve(__dirname, '../app/not-found.tsx');

  const adminLoginPagePath = path.resolve(__dirname, '../../../admin/src/app/login/page.tsx');
  const adminNotFoundPagePath = path.resolve(__dirname, '../../../admin/src/app/not-found.tsx');
  const adminForbiddenPagePath = path.resolve(__dirname, '../../../admin/src/app/forbidden/page.tsx');
  const adminUsersPagePath = path.resolve(__dirname, '../../../admin/src/app/(dashboard)/users/page.tsx');
  const adminUserDetailPagePath = path.resolve(__dirname, '../../../admin/src/app/(dashboard)/users/[id]/page.tsx');
  const adminJobsPagePath = path.resolve(__dirname, '../../../admin/src/app/(dashboard)/jobs/page.tsx');

  it('standardizes Course Detail page with shadcn Card, Table, and Motion without raw HTML table or micro-typography', () => {
    const content = fs.readFileSync(courseDetailPagePath, 'utf-8');

    expect(content).not.toMatch(/<table\b/);
    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');

    expect(content).toContain('<Card');
    expect(content).toContain('<CardHeader');
    expect(content).toContain('<CardTitle');
    expect(content).toContain('<CardContent');
    expect(content).toContain('<Table>');
    expect(content).toContain('<TableHeader');
    expect(content).toContain('<TableBody>');
    expect(content).toContain('FadeIn');
    expect(content).toContain('StaggerGroup');
    expect(content).toContain('StaggerItem');
    expect(content).toContain('AnimatedPanel');
  });

  it('standardizes Schedule and Calendar views with shadcn Card, Motion, text-xs, and tabular-nums', () => {
    const scheduleContent = fs.readFileSync(schedulePagePath, 'utf-8');
    const calendarContent = fs.readFileSync(calendarPagePath, 'utf-8');
    const monthContent = fs.readFileSync(monthViewPath, 'utf-8');
    const weekContent = fs.readFileSync(weekViewPath, 'utf-8');
    const agendaContent = fs.readFileSync(agendaViewPath, 'utf-8');
    const dayEventsContent = fs.readFileSync(dayEventsDialogPath, 'utf-8');
    const eventDetailContent = fs.readFileSync(eventDetailDialogPath, 'utf-8');

    for (const content of [
      scheduleContent,
      calendarContent,
      monthContent,
      weekContent,
      agendaContent,
      dayEventsContent,
      eventDetailContent,
    ]) {
      expect(content).not.toContain('text-[10px]');
      expect(content).not.toContain('text-[11px]');
      expect(content).toContain('tabular-nums');
    }

    expect(scheduleContent).toContain('FadeIn');
    expect(scheduleContent).toContain('StaggerGroup');
    expect(scheduleContent).toContain('StaggerItem');
    expect(scheduleContent).toContain('AnimatedPanel');
    expect(scheduleContent).toContain('<Card');

    expect(calendarContent).toContain('FadeIn');
    expect(calendarContent).toContain('AnimatedPanel');
    expect(calendarContent).toContain('<Card');
    expect(monthContent).toContain('<Card');
    expect(weekContent).toContain('<Card');
    expect(agendaContent).toContain('<Card');
  });

  it('standardizes Global Search Dialog with Motion FadeIn and text-xs without micro-typography', () => {
    const content = fs.readFileSync(globalSearchDialogPath, 'utf-8');

    expect(content).not.toContain('text-[10px]');
    expect(content).not.toContain('text-[11px]');
    expect(content).toContain('FadeIn');
  });

  it('standardizes Authentication and 404/403 Error pages across Student and Admin portals with Card and FadeIn', () => {
    const studentAuthFiles = [
      webLoginPagePath,
      webRegisterPagePath,
      webForgotPasswordPagePath,
      webResetPasswordPagePath,
      webVerifyEmailClientPath,
    ];

    for (const filePath of studentAuthFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('text-[10px]');
      expect(content).not.toContain('text-[11px]');
      expect(content).toContain('FadeIn');
      expect(content).toContain('<Card');
    }

    const adminLoginContent = fs.readFileSync(adminLoginPagePath, 'utf-8');
    expect(adminLoginContent).not.toContain('text-[10px]');
    expect(adminLoginContent).not.toContain('text-[11px]');
    expect(adminLoginContent).toContain('FadeIn');
    expect(adminLoginContent).toContain('<LoginForm');

    const errorFiles = [webNotFoundPagePath, adminNotFoundPagePath, adminForbiddenPagePath];
    for (const filePath of errorFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('FadeIn');
      expect(content).toContain('<Card');
      expect(content).toContain('<CardHeader');
      expect(content).toContain('<CardTitle');
      expect(content).toContain('<CardFooter');
    }
  });

  it('standardizes Admin Users, User Detail, and Jobs pages with Card, Motion, tabular-nums, and zero AI Slop Sparkles', () => {
    const usersContent = fs.readFileSync(adminUsersPagePath, 'utf-8');
    const userDetailContent = fs.readFileSync(adminUserDetailPagePath, 'utf-8');
    const jobsContent = fs.readFileSync(adminJobsPagePath, 'utf-8');

    expect(usersContent).toContain('FadeIn');
    expect(usersContent).toContain('<Card');
    expect(usersContent).toContain('<Table>');
    expect(usersContent).toContain('tabular-nums');

    expect(userDetailContent).toContain('FadeIn');
    expect(userDetailContent).toContain('StaggerGroup');
    expect(userDetailContent).toContain('StaggerItem');
    expect(userDetailContent).toContain('tabular-nums');

    expect(jobsContent).not.toContain('Sparkles');
    expect(jobsContent).not.toContain('text-[10px]');
    expect(jobsContent).not.toContain('text-[11px]');
    expect(jobsContent).toContain('FadeIn');
    expect(jobsContent).toContain('StaggerGroup');
    expect(jobsContent).toContain('StaggerItem');
    expect(jobsContent).toContain('<Card');
    expect(jobsContent).toContain('<Table>');
    expect(jobsContent).toContain('tabular-nums');
  });
});
