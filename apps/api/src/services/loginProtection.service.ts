import { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { getRateLimitRedisClient, hashAccountIdentifier } from '../middleware/rateLimiter.js';

/**
 * Adaptive CAPTCHA for email/password login.
 *
 * Two independent failure counters (15-minute window):
 * - per account (SHA-256 hashed normalized email; raw email never stored)
 * - per client IP (catches credential stuffing across many emails)
 *
 * CAPTCHA is required when either counter reaches its threshold.
 * Counters are tracked identically for registered and unregistered emails,
 * so the CAPTCHA signal never reveals whether an account exists.
 */

export const ACCOUNT_FAILURE_THRESHOLD = 3;
export const IP_FAILURE_THRESHOLD = 10;
const WINDOW_MS = 15 * 60 * 1000;
const KEY_PREFIX = 'studyflow:rl:login_fail:';

const INCREMENT_LUA = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return hits
`;

interface FailureKeys {
  account: string | null;
  ip: string;
}

function buildKeys(email: unknown, rawIp: string | undefined): FailureKeys {
  const accountHash = hashAccountIdentifier(email);
  return {
    account: accountHash ? `${KEY_PREFIX}acct:${accountHash}` : null,
    ip: `${KEY_PREFIX}ip:${ipKeyGenerator(rawIp || '127.0.0.1')}`,
  };
}

// ---- Memory store (used when RATE_LIMIT_STORE=memory, e.g. tests) ----
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

function memoryGet(key: string): number {
  const entry = memoryStore.get(key);
  if (!entry) return 0;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return 0;
  }
  return entry.count;
}

function memoryIncrement(key: string): number {
  const count = memoryGet(key) + 1;
  const existing = memoryStore.get(key);
  memoryStore.set(key, {
    count,
    expiresAt: existing && count > 1 ? existing.expiresAt : Date.now() + WINDOW_MS,
  });
  return count;
}

export function __resetLoginProtectionMemory(): void {
  memoryStore.clear();
}

function useRedis(): boolean {
  return env.RATE_LIMIT_STORE === 'redis';
}

async function getCounts(keys: FailureKeys): Promise<{ account: number; ip: number }> {
  if (!useRedis()) {
    return { account: keys.account ? memoryGet(keys.account) : 0, ip: memoryGet(keys.ip) };
  }
  const client = getRateLimitRedisClient();
  const [accountRaw, ipRaw] = await Promise.all([
    keys.account ? client.get(keys.account) : Promise.resolve(null),
    client.get(keys.ip),
  ]);
  return { account: Number(accountRaw ?? 0) || 0, ip: Number(ipRaw ?? 0) || 0 };
}

function exceedsThreshold(counts: { account: number; ip: number }): boolean {
  return counts.account >= ACCOUNT_FAILURE_THRESHOLD || counts.ip >= IP_FAILURE_THRESHOLD;
}

/**
 * Returns true when the next login attempt for this email/IP must include a Turnstile token.
 * Fail-closed: if the counter store is unavailable, CAPTCHA is required.
 */
export async function isCaptchaRequiredForLogin(email: unknown, rawIp: string | undefined): Promise<boolean> {
  try {
    return exceedsThreshold(await getCounts(buildKeys(email, rawIp)));
  } catch {
    console.error('[LOGIN_PROTECTION] Gagal membaca penghitung login; CAPTCHA diwajibkan (fail-closed).');
    return true;
  }
}

/**
 * Records a failed login attempt for both counters.
 * Returns true when CAPTCHA is now required for subsequent attempts.
 */
export async function recordLoginFailure(email: unknown, rawIp: string | undefined): Promise<boolean> {
  const keys = buildKeys(email, rawIp);
  try {
    if (!useRedis()) {
      const account = keys.account ? memoryIncrement(keys.account) : 0;
      const ip = memoryIncrement(keys.ip);
      return exceedsThreshold({ account, ip });
    }
    const client = getRateLimitRedisClient();
    const windowMs = String(WINDOW_MS);
    const [account, ip] = await Promise.all([
      keys.account ? (client.eval(INCREMENT_LUA, 1, keys.account, windowMs) as Promise<number>) : Promise.resolve(0),
      client.eval(INCREMENT_LUA, 1, keys.ip, windowMs) as Promise<number>,
    ]);
    return exceedsThreshold({ account: Number(account), ip: Number(ip) });
  } catch {
    console.error('[LOGIN_PROTECTION] Gagal mencatat kegagalan login; CAPTCHA diwajibkan (fail-closed).');
    return true;
  }
}

/**
 * Clears only the per-account counter after a successful login.
 * The per-IP counter is intentionally kept so an attacker cannot reset it
 * by logging into their own account between stuffing attempts.
 */
export async function resetAccountLoginFailures(email: unknown): Promise<void> {
  const { account } = buildKeys(email, undefined);
  if (!account) return;
  try {
    if (!useRedis()) {
      memoryStore.delete(account);
      return;
    }
    await getRateLimitRedisClient().del(account);
  } catch {
    console.error('[LOGIN_PROTECTION] Gagal mereset penghitung akun setelah login sukses.');
  }
}
