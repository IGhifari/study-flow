import { isIP } from 'node:net';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
}

export interface VerifyTurnstileOptions {
  token: string | undefined | null;
  remoteIp?: string | undefined;
}

const CLOUDFLARE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function isPrivateOrLoopbackIp(ip: string): boolean {
  const lower = ip.toLowerCase();

  // IPv4 checks
  const v4Parts = lower.split('.');
  if (v4Parts.length === 4) {
    const octets = v4Parts.map((part) => Number(part));
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = octets;
    if (a === undefined || b === undefined) {
      return true;
    }
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  // IPv6 loopback, unspecified, link-local (fe80::/10), unique local (fc00::/7)
  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1') {
    return true;
  }
  const firstSegment = lower.split(':')[0] || '';
  if (/^(fc|fd)[0-9a-f]{2}$/.test(firstSegment)) {
    return true;
  }
  if (/^fe[89ab][0-9a-f]$/.test(firstSegment)) {
    return true;
  }
  return false;
}

/**
 * Normalizes Express req.ip for Cloudflare Turnstile siteverify.
 * Unwraps IPv4-mapped IPv6 addresses (e.g. ::ffff:1.2.3.4) and omits loopback
 * or internal proxy addresses that should not be sent as client remoteip.
 */
export function normalizeTurnstileRemoteIp(rawIp: string | undefined | null): string | undefined {
  if (!rawIp || typeof rawIp !== 'string') {
    return undefined;
  }
  let candidate = rawIp.trim();
  if (!candidate) {
    return undefined;
  }
  if (candidate.toLowerCase().startsWith('::ffff:')) {
    candidate = candidate.slice(7);
  }
  if (isIP(candidate) === 0) {
    return undefined;
  }
  if (isPrivateOrLoopbackIp(candidate)) {
    return undefined;
  }
  return candidate;
}

/**
 * Verifies Cloudflare Turnstile CAPTCHA token with Cloudflare Siteverify endpoint.
 *
 * Security Requirements:
 * - Reject empty/null tokens.
 * - In non-test environments, if TURNSTILE_SECRET_KEY is configured, call Cloudflare Siteverify.
 * - In test environment, support official Cloudflare Turnstile test tokens:
 *   - 'XXXX.DUMMY.TOKEN.XXXX' or tokens containing 'pass'/'valid' or '1x00000000000000000000AA'
 *   - Allow deterministic mock injection via __setMockTurnstileVerifier for unit/integration tests.
 * - Fail safely (throw AppError with code 'TURNSTILE_VERIFICATION_FAILED' and status 400).
 * - Never log the secret key or raw credentials.
 */

type MockVerifier = ((token: string, remoteIp?: string) => Promise<boolean> | boolean) | null;
let mockVerifier: MockVerifier = null;

export function __setMockTurnstileVerifier(verifier: MockVerifier): void {
  mockVerifier = verifier;
}

export async function verifyTurnstileToken(options: VerifyTurnstileOptions): Promise<void> {
  const { token, remoteIp } = options;

  // When token is explicitly provided (or in production/when TURNSTILE_SECRET_KEY is configured),
  // a missing or blank token is rejected.
  const isEnforced = env.NODE_ENV !== 'test' || Boolean(env.TURNSTILE_SECRET_KEY) || mockVerifier !== null;

  if (isEnforced && (!token || typeof token !== 'string' || token.trim().length === 0)) {
    const error: AppError = new Error('Verifikasi keamanan Turnstile wajib diisi');
    error.statusCode = 400;
    error.code = 'TURNSTILE_TOKEN_REQUIRED';
    throw error;
  }

  // If token is missing in test environment when not explicitly tested/enforced, pass silently
  if (!token) {
    return;
  }

  const trimmedToken = token.trim();

  // 1. Mock verifier injection (used by automated integration tests)
  if (mockVerifier) {
    try {
      const passed = await mockVerifier(trimmedToken, remoteIp);
      if (!passed) {
        const error: AppError = new Error('Verifikasi keamanan gagal. Silakan coba lagi.');
        error.statusCode = 400;
        error.code = 'TURNSTILE_VERIFICATION_FAILED';
        throw error;
      }
      return;
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err) {
        throw err;
      }
      const error: AppError = new Error('Verifikasi keamanan gagal karena masalah jaringan. Silakan coba lagi.');
      error.statusCode = 503;
      error.code = 'TURNSTILE_NETWORK_ERROR';
      throw error;
    }
  }

  // 2. Test environment / unconfigured secret fallback handling
  // Cloudflare official dummy pass token: 'XXXX.DUMMY.TOKEN.XXXX'
  if (env.NODE_ENV === 'test') {
    if (trimmedToken.includes('invalid') || trimmedToken.includes('fail')) {
      const error: AppError = new Error('Verifikasi keamanan gagal. Silakan coba lagi.');
      error.statusCode = 400;
      error.code = 'TURNSTILE_VERIFICATION_FAILED';
      throw error;
    }
    // Accept valid test tokens
    return;
  }

  // In production, missing or insecure secret key must fail closed with a configuration error (defense-in-depth)
  const trimmedSecret = env.TURNSTILE_SECRET_KEY?.trim() || '';
  const isInsecureSecret =
    !trimmedSecret ||
    trimmedSecret === '1x0000000000000000000000000000000AA' ||
    trimmedSecret === '2x0000000000000000000000000000000AA' ||
    trimmedSecret === '3x0000000000000000000000000000000AA' ||
    trimmedSecret.startsWith('studyflow_dev_');

  if (isInsecureSecret && env.NODE_ENV === 'production') {
    console.error('[TURNSTILE] TURNSTILE_SECRET_KEY tidak valid atau belum dikonfigurasi di environment production.');
    const error: AppError = new Error('Layanan verifikasi keamanan server belum dikonfigurasi dengan benar.');
    error.statusCode = 500;
    error.code = 'CONFIGURATION_ERROR';
    throw error;
  }

  // If secret key is not configured in local development, log warning and bypass safely
  // (Prevents developer lockout when testing unrelated flows without Turnstile credentials)
  if (!env.TURNSTILE_SECRET_KEY) {
    console.warn('[TURNSTILE] TURNSTILE_SECRET_KEY belum dikonfigurasi. Verifikasi dilewati untuk local development.');
    return;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', trimmedToken);
    const normalizedIp = normalizeTurnstileRemoteIp(remoteIp);
    if (normalizedIp) {
      formData.append('remoteip', normalizedIp);
    }

    const response = await fetch(CLOUDFLARE_SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      // 5 seconds timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`[TURNSTILE] Cloudflare siteverify HTTP error: ${response.status}`);
      const error: AppError = new Error('Verifikasi keamanan gagal menghubungi server. Silakan coba lagi.');
      error.statusCode = 503;
      error.code = 'TURNSTILE_SERVICE_UNAVAILABLE';
      throw error;
    }

    const data = (await response.json()) as {
      success?: boolean;
      'error-codes'?: string[];
      hostname?: string;
    };

    if (!data.success) {
      console.warn(`[TURNSTILE] Verifikasi token gagal. Error codes: ${JSON.stringify(data['error-codes'] || [])}`);
      const error: AppError = new Error('Verifikasi keamanan gagal. Silakan coba lagi.');
      error.statusCode = 400;
      error.code = 'TURNSTILE_VERIFICATION_FAILED';
      throw error;
    }
  } catch (err: unknown) {
    if (err instanceof Error && 'statusCode' in err) {
      throw err;
    }
    console.error('[TURNSTILE] Network error or timeout contacting Cloudflare siteverify');
    const error: AppError = new Error('Verifikasi keamanan gagal karena masalah jaringan. Silakan coba lagi.');
    error.statusCode = 503;
    error.code = 'TURNSTILE_NETWORK_ERROR';
    throw error;
  }
}
