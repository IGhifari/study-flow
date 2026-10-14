import { isIP } from 'node:net';

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
