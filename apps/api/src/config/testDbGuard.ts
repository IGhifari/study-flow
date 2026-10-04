/**
 * Guards that prevent destructive test suites (and API processes started with
 * NODE_ENV=test) from ever targeting a non-test database.
 *
 * Policy: a database is considered a test database only if its name ends with `_test`.
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

export function isTestDatabaseUrl(url: string | undefined): boolean {
  const name = getDatabaseName(url);
  return name !== null && /_test$/.test(name);
}

export function assertTestDatabaseUrl(url: string | undefined, variableName: string): void {
  if (!isTestDatabaseUrl(url)) {
    // Never print the URL itself (it contains credentials); only the variable name and DB name.
    const name = getDatabaseName(url);
    throw new Error(
      `[TEST DB GUARD] ${variableName} harus menunjuk database yang namanya berakhiran "_test" ` +
        `(saat ini: ${name ?? 'tidak diset/tidak valid'}). Pengujian dibatalkan untuk melindungi data development.`
    );
  }
}
