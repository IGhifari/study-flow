export const CLOUDFLARE_TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

/**
 * Resolves the Cloudflare Turnstile public site key from the runtime environment.
 * Dynamic key lookup prevents Next.js from statically inlining a local .env.local
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY into server bundles during Cloudflare builds.
 */
export function resolveTurnstileSiteKey(
  runtimeEnv: Record<string, string | undefined> = process.env
): string {
  const privateKeyName = ['TURNSTILE', 'SITE_KEY'].join('_');
  const publicKeyName = ['NEXT_PUBLIC', 'TURNSTILE_SITE_KEY'].join('_');

  const candidate =
    runtimeEnv[privateKeyName]?.trim() || runtimeEnv[publicKeyName]?.trim();

  return candidate || CLOUDFLARE_TURNSTILE_TEST_SITE_KEY;
}
