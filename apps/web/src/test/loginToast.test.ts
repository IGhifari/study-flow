import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Auth Toast Notifications (Sonner Red Error & Green Success)', () => {
  const sonnerPath = path.resolve(__dirname, '../components/ui/sonner.tsx');
  const layoutPath = path.resolve(__dirname, '../app/layout.tsx');
  const loginPagePath = path.resolve(__dirname, '../app/(auth)/login/page.tsx');
  const registerPagePath = path.resolve(__dirname, '../app/(auth)/register/page.tsx');

  it('exports Toaster and toast with top-right position, red error styling, and green success styling in sonner.tsx', () => {
    const sonnerContent = fs.readFileSync(sonnerPath, 'utf-8');

    expect(sonnerContent).toContain('export { Toaster, toast }');
    expect(sonnerContent).toContain('position = "top-right"');
    expect(sonnerContent).toContain('position={position}');

    // Red error styling
    expect(sonnerContent).toContain('!bg-red-600');
    expect(sonnerContent).toContain('!text-white');
    expect(sonnerContent).toContain('!border-red-600');

    // Green success styling
    expect(sonnerContent).toContain('!bg-emerald-600');
    expect(sonnerContent).toContain('!text-white');
    expect(sonnerContent).toContain('!border-emerald-600');
  });

  it('mounts Toaster in RootLayout with top-right position', () => {
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    expect(layoutContent).toContain("import { Toaster } from '@/components/ui/sonner'");
    expect(layoutContent).toContain('<Toaster position="top-right" />');
  });

  it('triggers toast.error and toast.success, and removes inline destructive Alert in login/page.tsx', () => {
    const loginContent = fs.readFileSync(loginPagePath, 'utf-8');

    expect(loginContent).toContain("import { toast } from '@/components/ui/sonner'");
    expect(loginContent).toContain('toast.error(errorMessage)');
    expect(loginContent).toContain('toast.error(urlError)');
    expect(loginContent).toContain('toast.success(');

    // Should NOT have inline destructive Alert banner
    expect(loginContent).not.toContain('<Alert variant="destructive"');
  });

  it('triggers toast.error and toast.success, and removes inline destructive Alert in register/page.tsx', () => {
    const registerContent = fs.readFileSync(registerPagePath, 'utf-8');

    expect(registerContent).toContain("import { toast } from '@/components/ui/sonner'");
    expect(registerContent).toContain('toast.error(errorMessage)');
    expect(registerContent).toContain('toast.error(urlError)');
    expect(registerContent).toContain('toast.success(');

    // Should NOT have inline destructive Alert banner
    expect(registerContent).not.toContain('<Alert variant="destructive"');
  });
});
