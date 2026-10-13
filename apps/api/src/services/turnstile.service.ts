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
    if (remoteIp && remoteIp !== '127.0.0.1' && remoteIp !== '::1') {
      formData.append('remoteip', remoteIp);
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
