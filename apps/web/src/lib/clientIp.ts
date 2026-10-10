import { isIP } from 'node:net';

/**
 * Resolves the client IP to forward to the Express API backend.
 *
 * Security Design & Threat Model:
 * 1. Default Mode (TRUSTED_CLIENT_IP_HEADER unset / empty / 'none'):
 *    Without a verified reverse proxy ingress, client-provided IP headers (X-Forwarded-For,
 *    X-Real-IP, CF-Connecting-IP, etc.) MUST NEVER be trusted, as unverified clients can forge
 *    them to evade rate limits or spoof identities.
 *    In this mode, client IP is strictly fixed to '127.0.0.1'. All requests through BFF share a single
 *    IP rate limiting bucket. Defense against brute force relies on account-level rate limiting
 *    (loginAccountRateLimiter) which keys off normalized user identifier.
 *
 * 2. Trusted Ingress Mode (TRUSTED_CLIENT_IP_HEADER set to exact header, e.g. 'x-real-ip'):
 *    The ingress proxy (e.g. Nginx, Cloudflare, AWS ALB) MUST overwrite this header with the
 *    actual TCP peer IP, and direct access to BFF origin MUST be restricted.
 *    The BFF checks ONLY this single configured header and ignores all alternative headers.
 *    The extracted IP is strictly validated against IPv4/IPv6 syntax using isIP().
 *    If missing, malformed, or invalid, falls back to '127.0.0.1'.
 */
export function resolveForwardedClientIp(headers: Headers): string {
  const trustedHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();

  // Mode Default: Without trusted ingress, never trust user-supplied headers
  if (!trustedHeader || trustedHeader === 'none') {
    return '127.0.0.1';
  }

  // Trusted Ingress Mode: Read ONLY the single configured header
  const rawValue = headers.get(trustedHeader);
  if (!rawValue) {
    return '127.0.0.1';
  }

  // If header contains comma-separated values (e.g. proxy list), take the client IP (first entry)
  const candidate = rawValue.split(',')[0]?.trim();
  if (candidate && isIP(candidate) !== 0) {
    return candidate;
  }

  // Fallback to safe local address if IP format is invalid or malformed
  return '127.0.0.1';
}
