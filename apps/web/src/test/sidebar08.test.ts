import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('shadcn/ui sidebar-08 Architecture & Invariant Tests', () => {
  const webDir = path.resolve(__dirname, '..');
  const adminDir = path.resolve(__dirname, '../../../admin/src');

  const webSidebarUiPath = path.join(webDir, 'components/ui/sidebar.tsx');
  const adminSidebarUiPath = path.join(adminDir, 'components/ui/sidebar.tsx');
  const webAppSidebarPath = path.join(webDir, 'components/layout/app-sidebar.tsx');
  const webNavUserPath = path.join(webDir, 'components/layout/nav-user.tsx');
  const webAppShellPath = path.join(webDir, 'components/layout/app-shell.tsx');
  const adminAppSidebarPath = path.join(adminDir, 'components/app-sidebar.tsx');
  const adminNavSecondaryPath = path.join(adminDir, 'components/nav-secondary.tsx');
  const adminNavUserPath = path.join(adminDir, 'components/nav-user.tsx');
  const adminHeaderPath = path.join(adminDir, 'components/admin-header.tsx');
  const adminLayoutPath = path.join(adminDir, 'app/(dashboard)/layout.tsx');

  it('1. SidebarProvider in apps/web and apps/admin supports has-data-[variant=inset]:bg-sidebar', () => {
    const webSidebarUi = fs.readFileSync(webSidebarUiPath, 'utf-8');
    const adminSidebarUi = fs.readFileSync(adminSidebarUiPath, 'utf-8');

    expect(webSidebarUi).toContain('has-data-[variant=inset]:bg-sidebar');
    expect(adminSidebarUi).toContain('has-data-[variant=inset]:bg-sidebar');
  });

  it('2. SidebarInset in apps/web and apps/admin renders rounded-xl inset card styling', () => {
    const webSidebarUi = fs.readFileSync(webSidebarUiPath, 'utf-8');
    const adminSidebarUi = fs.readFileSync(adminSidebarUiPath, 'utf-8');

    expect(webSidebarUi).toContain('lg:peer-data-[variant=inset]:m-2');
    expect(webSidebarUi).toContain('lg:peer-data-[variant=inset]:rounded-xl');
    expect(adminSidebarUi).toContain('lg:peer-data-[variant=inset]:m-2');
    expect(adminSidebarUi).toContain('lg:peer-data-[variant=inset]:rounded-xl');
  });

  it('3. Sidebar primitive in apps/web and apps/admin handles variant="inset" with p-2 bg-sidebar and without border-r', () => {
    const webSidebarUi = fs.readFileSync(webSidebarUiPath, 'utf-8');
    const adminSidebarUi = fs.readFileSync(adminSidebarUiPath, 'utf-8');

    expect(webSidebarUi).toContain("variant === 'inset'");
    expect(webSidebarUi).toContain("'p-2 bg-sidebar'");
    expect(adminSidebarUi).toContain("variant === 'inset'");
    expect(adminSidebarUi).toContain("'p-2 bg-sidebar'");
  });

  it('4. Student AppSidebar uses variant="inset" and collapsible="icon"', () => {
    const webAppSidebar = fs.readFileSync(webAppSidebarPath, 'utf-8');
    const webAppShell = fs.readFileSync(webAppShellPath, 'utf-8');

    expect(webAppSidebar).toContain('variant="inset"');
    expect(webAppSidebar).toContain('collapsible="icon"');
    expect(webAppShell).toContain('<AppSidebar user={currentUser} />');
    expect(webAppShell).toContain('rounded-t-xl border-b border-border/60');
  });

  it('5. Student SidebarHeader renders two-line StudyFlow / Ruang Belajar identity and retains SidebarSemesterSelector', () => {
    const webAppSidebar = fs.readFileSync(webAppSidebarPath, 'utf-8');

    expect(webAppSidebar).toContain('size="lg"');
    expect(webAppSidebar).toContain('StudyFlow');
    expect(webAppSidebar).toContain('Ruang Belajar');
    expect(webAppSidebar).toContain('<SidebarSemesterSelector');
  });

  it('6. Student SidebarContent separates main groups (Belajar, Perkuliahan) and bottom NavSecondary (mt-auto, size="sm")', () => {
    const webAppSidebar = fs.readFileSync(webAppSidebarPath, 'utf-8');

    expect(webAppSidebar).toContain("label: 'Belajar'");
    expect(webAppSidebar).toContain("label: 'Perkuliahan'");
    expect(webAppSidebar).toContain('className="mt-auto"');
    expect(webAppSidebar).toContain('size="sm"');
    expect(webAppSidebar).toContain("label: 'Kelola Semester'");
    expect(webAppSidebar).toContain("href: '/semesters'");
    expect(webAppSidebar).toContain("label: 'Pengaturan'");
    expect(webAppSidebar).toContain("href: '/settings'");
  });

  it('7. Student SidebarFooter renders NavUser with ChevronsUpDown and account dropdown actions', () => {
    const webAppSidebar = fs.readFileSync(webAppSidebarPath, 'utf-8');
    const webNavUser = fs.readFileSync(webNavUserPath, 'utf-8');

    expect(webAppSidebar).toContain('<NavUser user={user} />');
    expect(webNavUser).toContain('size="lg"');
    expect(webNavUser).toContain('ChevronsUpDown');
    expect(webNavUser).toContain('Pengaturan Akun');
    expect(webNavUser).toContain('Kelola Semester');
    expect(webNavUser).toContain('Keluar');
  });

  it('8. Admin AppSidebar uses variant="inset", NavMain, NavSecondary (mt-auto), and NavUser (ChevronsUpDown)', () => {
    const adminAppSidebar = fs.readFileSync(adminAppSidebarPath, 'utf-8');
    const adminNavSecondary = fs.readFileSync(adminNavSecondaryPath, 'utf-8');
    const adminNavUser = fs.readFileSync(adminNavUserPath, 'utf-8');
    const adminHeader = fs.readFileSync(adminHeaderPath, 'utf-8');
    const adminLayout = fs.readFileSync(adminLayoutPath, 'utf-8');

    expect(adminAppSidebar).toContain('variant="inset"');
    expect(adminAppSidebar).toContain('collapsible="icon"');
    expect(adminAppSidebar).toContain('Ringkasan');
    expect(adminAppSidebar).toContain('Pengguna');
    expect(adminAppSidebar).toContain('Pekerjaan');
    expect(adminAppSidebar).toContain('<NavSecondary items={navSecondary} className="mt-auto" />');
    expect(adminAppSidebar).toContain('Pekerjaan Gagal');
    expect(adminAppSidebar).toContain('/jobs?status=FAILED');
    expect(adminAppSidebar).toContain('Direktori Mahasiswa');
    expect(adminNavSecondary).toContain('size="sm"');
    expect(adminNavUser).toContain('ChevronsUpDown');
    expect(adminHeader).toContain('rounded-t-xl border-b border-border/60');
    expect(adminLayout).toContain('<div className="flex flex-1 flex-col">{children}</div>');
  });

  it('9. Neither apps/web nor apps/admin sidebar files contain dead href="#" links', () => {
    const filesToCheck = [
      webAppSidebarPath,
      webNavUserPath,
      webAppShellPath,
      adminAppSidebarPath,
      adminNavSecondaryPath,
      adminNavUserPath,
    ];

    for (const filePath of filesToCheck) {
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('href="#"');
      expect(content).not.toContain("url: '#'");
      expect(content).not.toContain('url: "#"');
    }
  });
});
