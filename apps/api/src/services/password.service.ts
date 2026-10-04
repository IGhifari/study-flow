import * as argon2 from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

// OWASP-recommended Argon2id parameters (RFC 9106)
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,       // 2 iterations
  outputLen: 32,     // 32 bytes output length
  parallelism: 1,    // 1 lane
  algorithm: argon2.Algorithm.Argon2id,
};

/**
 * Hash a password using Argon2id.
 * Natively supports passwords up to 128 characters without silent truncation.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 * Supports Argon2id and provides backward compatibility for legacy bcrypt hashes.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  // Modern Argon2id hashes ($argon2id$, $argon2i$, $argon2d$)
  if (hash.startsWith('$argon2')) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  // Legacy bcrypt hashes ($2a$, $2b$, $2y$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Checks whether the stored hash needs to be upgraded to modern Argon2id.
 */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith('$argon2');
}
