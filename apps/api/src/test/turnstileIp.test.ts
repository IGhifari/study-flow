import { describe, it, expect } from 'vitest';
import { normalizeTurnstileRemoteIp } from '../services/turnstile.service.js';

describe('normalizeTurnstileRemoteIp', () => {
  it('returns undefined for missing, blank, or invalid IP inputs', () => {
    expect(normalizeTurnstileRemoteIp(undefined)).toBeUndefined();
    expect(normalizeTurnstileRemoteIp(null)).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('   ')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('not-an-ip')).toBeUndefined();
  });

  it('omits IPv4 and IPv6 loopback addresses including IPv4-mapped loopback', () => {
    expect(normalizeTurnstileRemoteIp('127.0.0.1')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('127.0.1.1')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('::1')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('::')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('::ffff:127.0.0.1')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('::FFFF:127.0.0.5')).toBeUndefined();
  });

  it('omits RFC1918 private, link-local, and IPv6 local internal proxy addresses', () => {
    expect(normalizeTurnstileRemoteIp('10.0.0.5')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('::ffff:10.20.30.40')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('172.16.0.1')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('172.31.255.254')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('192.168.1.10')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('169.254.169.254')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('fe80::1')).toBeUndefined();
    expect(normalizeTurnstileRemoteIp('fd00::1')).toBeUndefined();
  });

  it('preserves public IPv4, unwraps IPv4-mapped public IPv4, and preserves public IPv6', () => {
    expect(normalizeTurnstileRemoteIp('203.0.113.5')).toBe('203.0.113.5');
    expect(normalizeTurnstileRemoteIp('  ::ffff:198.51.100.42  ')).toBe('198.51.100.42');
    expect(normalizeTurnstileRemoteIp('172.32.0.1')).toBe('172.32.0.1');
    expect(normalizeTurnstileRemoteIp('2001:4860:4860::8888')).toBe('2001:4860:4860::8888');
  });
});
