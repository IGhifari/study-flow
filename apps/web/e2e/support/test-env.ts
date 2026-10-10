/**
 * Test Environment Isolation Guard for StudyFlow E2E.
 *
 * Guarantees that E2E tests only execute against isolated test infrastructure:
 * 1. DATABASE_URL_TEST is strictly required and must target a database ending in "_test".
 * 2. Fallback to DATABASE_URL is eliminated to protect development data.
 * 3. REDIS_URL_TEST is strictly required and must not reuse the development Redis instance/database.
 * 4. Fallback to REDIS_URL is eliminated.
 * 5. Credentials (passwords, usernames, secrets) are never leaked in log messages or errors.
 */

export interface ParsedRedisTarget {
  host: string;
  port: string;
  dbIndex: number;
}

export interface E2ETestConfig {
  databaseUrl: string;
  redisUrl: string;
}

/**
 * Extracts database name from connection URL without leaking credentials.
 */
export function getDatabaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

/**
 * Validates that database name ends with `_test`.
 */
export function isTestDatabaseUrl(url: string | undefined): boolean {
  const name = getDatabaseName(url);
  return name !== null && /_test$/.test(name);
}

/**
 * Parses Redis URL into host, port, and dbIndex without leaking credentials.
 */
export function parseRedisUrl(urlStr: string | undefined): ParsedRedisTarget | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    const rawPath = parsed.pathname.replace(/^\//, '');
    let dbIndex = 0;
    if (rawPath.length > 0) {
      const parsedNum = parseInt(rawPath, 10);
      if (Number.isNaN(parsedNum) || parsedNum < 0) {
        return null;
      }
      dbIndex = parsedNum;
    }
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port || '6379',
      dbIndex,
    };
  } catch {
    return null;
  }
}

/**
 * Asserts that the test database target is explicitly configured and safe.
 */
export function assertTestDatabaseTarget(dbTestUrl: string | undefined, dbDevUrl?: string | undefined): void {
  if (!dbTestUrl || dbTestUrl.trim().length === 0) {
    throw new Error(
      '[E2E ISOLATION GUARD] DATABASE_URL_TEST tidak diset. Konfigurasi target database test wajib disediakan secara eksplisit untuk mencegah penggunaan database development.'
    );
  }

  const dbTestName = getDatabaseName(dbTestUrl);
  if (!dbTestName || !isTestDatabaseUrl(dbTestUrl)) {
    throw new Error(
      `[E2E ISOLATION GUARD] Target database test tidak aman. Nama database harus berakhiran "_test" (terdeteksi: "${dbTestName ?? 'tidak valid'}"). Operasi database dibatalkan.`
    );
  }

  if (dbDevUrl) {
    const dbDevName = getDatabaseName(dbDevUrl);
    if (dbDevName && dbDevName === dbTestName && !isTestDatabaseUrl(dbDevUrl)) {
      throw new Error(
        `[E2E ISOLATION GUARD] Target database test tidak aman karena menunjuk basis data yang sama dengan DATABASE_URL development ("${dbTestName}"). Operasi database dibatalkan.`
      );
    }
  }
}

/**
 * Asserts that the test Redis target is explicitly configured and isolated from development Redis.
 */
export function assertTestRedisTarget(redisTestUrl: string | undefined, redisDevUrl?: string | undefined): void {
  if (!redisTestUrl || redisTestUrl.trim().length === 0) {
    throw new Error(
      '[E2E ISOLATION GUARD] REDIS_URL_TEST tidak diset. Target Redis khusus test wajib disediakan secara eksplisit untuk mencegah penggunaan Redis development.'
    );
  }

  const parsedRedisTest = parseRedisUrl(redisTestUrl);
  if (!parsedRedisTest) {
    throw new Error(
      '[E2E ISOLATION GUARD] Format REDIS_URL_TEST tidak valid. Operasi dibatalkan.'
    );
  }

  if (redisDevUrl) {
    const parsedRedisDev = parseRedisUrl(redisDevUrl);
    if (parsedRedisDev) {
      const sameHost = parsedRedisTest.host === parsedRedisDev.host;
      const samePort = parsedRedisTest.port === parsedRedisDev.port;
      const sameDb = parsedRedisTest.dbIndex === parsedRedisDev.dbIndex;

      if (sameHost && samePort && sameDb) {
        throw new Error(
          `[E2E ISOLATION GUARD] Target REDIS_URL_TEST tidak aman karena sama persis dengan REDIS_URL development (host: ${parsedRedisTest.host}:${parsedRedisTest.port}, DB: ${parsedRedisTest.dbIndex}). Redis test harus menggunakan target terpisah.`
        );
      }
    }
  }

  if (
    (parsedRedisTest.host === 'localhost' || parsedRedisTest.host === '127.0.0.1') &&
    parsedRedisTest.port === '6379' &&
    parsedRedisTest.dbIndex === 0
  ) {
    throw new Error(
      '[E2E ISOLATION GUARD] Target REDIS_URL_TEST pada localhost:6379 tidak boleh menggunakan database default (0). Gunakan indeks database khusus test (misalnya /15).'
    );
  }
}

/**
 * Validates E2E test configuration and returns sanitized test configuration.
 * Halts with clear errors if configuration is missing or unsafe.
 */
export function validateE2EConfig(env: NodeJS.ProcessEnv = process.env): E2ETestConfig {
  const dbTestUrl = env.DATABASE_URL_TEST;
  const dbDevUrl = env.DATABASE_URL;
  const redisTestUrl = env.REDIS_URL_TEST;
  const redisDevUrl = env.REDIS_URL;

  assertTestDatabaseTarget(dbTestUrl, dbDevUrl);
  assertTestRedisTarget(redisTestUrl, redisDevUrl);

  return {
    databaseUrl: dbTestUrl!,
    redisUrl: redisTestUrl!,
  };
}
