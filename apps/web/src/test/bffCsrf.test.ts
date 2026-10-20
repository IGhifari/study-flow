import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { validateCsrfOrigin } from '../lib/bff-proxy.js';

describe('BFF CSRF Origin Validation', () => {
  it('allows requests with Origin http://localhost:3005', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3005',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('allows requests with Origin http://localhost:3005/ (trailing slash)', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3005/',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('allows requests with Referer http://localhost:3005/dashboard without Origin header', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Referer: 'http://localhost:3005/dashboard',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('allows requests with Origin http://127.0.0.1:3005', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'http://127.0.0.1:3005',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(true);
  });

  it('rejects malicious attacker origins', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'https://evil-attacker.com',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Origin tidak diizinkan');
  });

  it('rejects null origin', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        Origin: 'null',
      },
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Origin null tidak diizinkan');
  });

  it('rejects request with missing Origin and Referer', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
    });

    const result = validateCsrfOrigin(req);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Header Origin atau Referer wajib ada');
  });
});
