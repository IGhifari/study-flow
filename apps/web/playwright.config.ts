import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Playwright E2E Isolation Strategy:
 * 1. Dedicated test ports (Web: 3100, API: 4100).
 * 2. Dedicated test database (studyflow_test) and Redis DB index (15).
 * 3. Mock AI Provider for deterministic results.
 * 4. Local storage shared between API and Worker via absolute path.
 * 5. Absolute repoRoot calculation using ESM-safe fileURLToPath.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const testStorageDir = path.resolve(repoRoot, '.storage-e2e/materials');

const TEST_API_PORT = 4100;
const TEST_WEB_PORT = 3100;
const TEST_REDIS_DB = 15;

const sharedTestEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://studyflow_user:studyflow_dev_password@localhost:5433/studyflow_test?schema=public',
  REDIS_URL: `redis://localhost:6379/${TEST_REDIS_DB}`,
  AI_PROVIDER: 'mock',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: testStorageDir,
  JWT_ACCESS_SECRET: 'test_jwt_access_secret_super_secure_32_chars',
  JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_super_secure_32_chars',
  COOKIE_SECRET: 'test_cookie_secret_super_secure_32_chars',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      cwd: repoRoot,
      command: 'npx concurrently -k -n "api,worker" "npm run dev:api" "npm run dev:worker"',
      env: {
        ...sharedTestEnv,
        PORT: String(TEST_API_PORT),
        CORS_ORIGIN: `http://localhost:${TEST_WEB_PORT}`,
        API_BASE_URL: `http://localhost:${TEST_API_PORT}`,
      },
      url: `http://localhost:${TEST_API_PORT}/ready`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      cwd: repoRoot,
      command: 'npx next start apps/web -p 3100',
      env: {
        ...sharedTestEnv,
        NODE_ENV: 'production',
        PORT: String(TEST_WEB_PORT),
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_API_URL: `http://localhost:${TEST_API_PORT}`,
        INTERNAL_API_URL: `http://localhost:${TEST_API_PORT}`,
      },
      url: `http://localhost:${TEST_WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
