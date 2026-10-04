import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword, needsRehash } from '../services/password.service.js';

describe('Password Service & Boundary Specifications', () => {
  it('should hash and verify standard passwords correctly', async () => {
    const password = 'MahasiswaTeknik2026!';
    const hash = await hashPassword(password);

    expect(hash).toContain('$argon2id$');
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword123!', hash)).toBe(false);
  });

  it('should handle long passwords (128 characters) without error or truncation', async () => {
    // 128 characters password
    const longPassword = 'A'.repeat(64) + 'b'.repeat(32) + '1234567890!@#$%^&*' + 'Z'.repeat(14);
    expect(longPassword.length).toBe(128);

    const hash = await hashPassword(longPassword);
    expect(await verifyPassword(longPassword, hash)).toBe(true);

    // Slightly modified 128-char password must fail
    const altered = longPassword.slice(0, -1) + 'X';
    expect(await verifyPassword(altered, hash)).toBe(false);
  });

  it('should handle multibyte UTF-8 characters without byte miscalculation', async () => {
    // Multibyte string containing 3-byte and 4-byte UTF-8 characters (emojis, accents)
    const multibytePassword = 'Belajar💡📚KuasaiTeknik2026🇮🇩✨SuperKuat!';
    const byteLength = Buffer.byteLength(multibytePassword, 'utf8');
    expect(byteLength).toBeGreaterThan(multibytePassword.length);

    const hash = await hashPassword(multibytePassword);
    expect(await verifyPassword(multibytePassword, hash)).toBe(true);
    expect(await verifyPassword('Belajar💡📚KuasaiTeknik2026🇮🇩✨SalahKuat!', hash)).toBe(false);
  });

  it('CRITICAL: Two passwords sharing the first 72 bytes must NOT be treated as identical', async () => {
    // In bcrypt, inputs are truncated after 72 bytes.
    // Under Argon2id, passwords beyond 72 bytes are hashed in full.
    const prefix72 = 'a'.repeat(72);
    const passwordA = prefix72 + 'SuffixOne123';
    const passwordB = prefix72 + 'SuffixTwo456';

    expect(Buffer.byteLength(prefix72, 'utf8')).toBe(72);
    expect(passwordA).not.toBe(passwordB);

    const hashA = await hashPassword(passwordA);
    const hashB = await hashPassword(passwordB);

    // Password A must match hash A, but NOT hash B
    expect(await verifyPassword(passwordA, hashA)).toBe(true);
    expect(await verifyPassword(passwordB, hashA)).toBe(false);

    // Password B must match hash B, but NOT hash A
    expect(await verifyPassword(passwordB, hashB)).toBe(true);
    expect(await verifyPassword(passwordA, hashB)).toBe(false);
  });

  it('should maintain backward compatibility with existing bcrypt hashes', async () => {
    const existingPassword = 'LegacyBcryptPassword123!';
    const legacyBcryptHash = await bcrypt.hash(existingPassword, 10);

    expect(legacyBcryptHash).toMatch(/^\$2[aby]\$/);

    // Existing users can still log in
    expect(await verifyPassword(existingPassword, legacyBcryptHash)).toBe(true);
    expect(await verifyPassword('WrongLegacyPassword!', legacyBcryptHash)).toBe(false);

    // Flag that it needs rehash to modern Argon2id
    expect(needsRehash(legacyBcryptHash)).toBe(true);

    // Modern Argon2id hashes do not need rehash
    const modernHash = await hashPassword(existingPassword);
    expect(needsRehash(modernHash)).toBe(false);
  });
});
