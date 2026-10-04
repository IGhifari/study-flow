import { describe, it, expect } from 'vitest';
import { isTestDatabaseUrl, assertTestDatabaseUrl, getDatabaseName } from '../config/testDbGuard.js';

describe('Test Database Guard', () => {
  it('should extract database name properly', () => {
    expect(getDatabaseName('postgresql://user:pass@localhost:5433/studyflow_test?schema=public')).toBe('studyflow_test');
    expect(getDatabaseName('postgresql://user:pass@localhost:5433/studyflow_dev')).toBe('studyflow_dev');
    expect(getDatabaseName(undefined)).toBeNull();
  });

  it('should accept database names ending with _test', () => {
    expect(isTestDatabaseUrl('postgresql://user:pass@localhost:5433/studyflow_test?schema=public')).toBe(true);
    expect(isTestDatabaseUrl('postgresql://user:pass@localhost:5433/ci_test')).toBe(true);
    expect(isTestDatabaseUrl('postgresql://user:pass@localhost:5433/studyflow_dev')).toBe(false);
    expect(isTestDatabaseUrl('postgresql://user:pass@localhost:5433/production_db')).toBe(false);
  });

  it('should throw safe error when test database is not ending in _test without printing credentials', () => {
    expect(() => {
      assertTestDatabaseUrl('postgresql://secret_user:super_secret_pw@localhost:5433/studyflow_dev', 'DATABASE_URL');
    }).toThrowError(/DATABASE_URL harus menunjuk database yang namanya berakhiran "_test"/);

    // Verify password is never leaked in the error message
    try {
      assertTestDatabaseUrl('postgresql://secret_user:super_secret_pw@localhost:5433/studyflow_dev', 'DATABASE_URL');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      expect(msg).not.toContain('super_secret_pw');
      expect(msg).not.toContain('secret_user');
    }
  });
});
