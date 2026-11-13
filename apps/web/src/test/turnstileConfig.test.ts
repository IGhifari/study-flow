import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CLOUDFLARE_TURNSTILE_TEST_SITE_KEY,
  resolveTurnstileSiteKey,
} from '../lib/turnstile-config';

describe('Turnstile Runtime Site Key Resolution', () => {
  it('falls back to Cloudflare official always-pass testing site key when unset or blank', () => {
    expect(resolveTurnstileSiteKey({})).toBe(CLOUDFLARE_TURNSTILE_TEST_SITE_KEY);
    expect(resolveTurnstileSiteKey({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: '   ' })).toBe(
      CLOUDFLARE_TURNSTILE_TEST_SITE_KEY
    );
  });

  it('prefers TURNSTILE_SITE_KEY over NEXT_PUBLIC_TURNSTILE_SITE_KEY and trims whitespace', () => {
    expect(
      resolveTurnstileSiteKey({
        TURNSTILE_SITE_KEY: ' 0x4AAAAAA_RUNTIME_KEY ',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      })
    ).toBe('0x4AAAAAA_RUNTIME_KEY');
  });

  it('reads runtime NEXT_PUBLIC_TURNSTILE_SITE_KEY (such as Cloudflare wrangler vars)', () => {
    expect(
      resolveTurnstileSiteKey({
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAF7bcWY_zVxAcJWr',
      })
    ).toBe('0x4AAAAAAF7bcWY_zVxAcJWr');
  });

  it('keeps (auth)/layout.tsx force-dynamic and wires TurnstileConfigProvider to TurnstileWidget', () => {
    const layoutContent = fs.readFileSync(
      path.resolve(__dirname, '../app/(auth)/layout.tsx'),
      'utf-8'
    );
    const widgetContent = fs.readFileSync(
      path.resolve(__dirname, '../components/auth/turnstile-widget.tsx'),
      'utf-8'
    );
    const registerContent = fs.readFileSync(
      path.resolve(__dirname, '../app/(auth)/register/page.tsx'),
      'utf-8'
    );

    expect(layoutContent).toContain("export const dynamic = 'force-dynamic'");
    expect(layoutContent).toContain('resolveTurnstileSiteKey()');
    expect(layoutContent).toContain('<TurnstileConfigProvider');
    expect(widgetContent).toContain('useTurnstileSiteKey()');
    expect(widgetContent).toContain('propSiteKey?.trim()');
    expect(registerContent).toContain('toast.error(msg)');
  });
});
