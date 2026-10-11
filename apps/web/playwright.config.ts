import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { validateE2EConfig } from './e2e/support/test-env.js';

/**
 * Playwright E2E Isolation Strategy:
 * 1. Dedicated test ports (Web: 3100, API: 4100).
 * 2. Dedicated test database (*_test) and isolated test Redis target.
 * 3. Fallbacks from test URLs to development URLs are eliminated.
 * 4. Database & Redis URLs forwarded strictly to child backend processes (API & Worker).
 * 5. Mock AI Provider for deterministic results.
 * 6. Local storage shared between API and Worker via absolute path.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const testStorageDir = path.resolve(repoRoot, '.storage-e2e/materials');

// Load .env.test if present (takes precedence), then .env for other base values
const rootEnvTest = path.resolve(repoRoot, '.env.test');
if (fs.existsSync(rootEnvTest)) {
  dotenv.config({ path: rootEnvTest });
}
const rootEnv = path.resolve(repoRoot, '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

// Strictly validate test environment before launching servers or running operations
const testConfig = validateE2EConfig(process.env);

const TEST_API_PORT = 4100;
const TEST_WEB_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
    trace: process.env.PW_NO_CAPTURE === '1' ? 'off' : 'on-first-retry',
    screenshot: process.env.PW_NO_CAPTURE === '1' ? 'off' : 'only-on-failure',
    video: process.env.PW_NO_CAPTURE === '1' ? 'off' : 'retain-on-failure',
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
        NODE_ENV: 'test',
        DATABASE_URL: testConfig.databaseUrl,
        REDIS_URL: testConfig.redisUrl,
        PORT: String(TEST_API_PORT),
        CORS_ORIGIN: `http://localhost:${TEST_WEB_PORT}`,
        API_BASE_URL: `http://localhost:${TEST_API_PORT}`,
        AI_PROVIDER: 'mock',
        STORAGE_DRIVER: 'local',
        LOCAL_STORAGE_DIR: testStorageDir,
        JWT_ACCESS_SECRET: 'test_jwt_access_secret_super_secure_32_chars',
        JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_super_secure_32_chars',
        COOKIE_SECRET: 'test_cookie_secret_super_secure_32_chars',
      },
      url: `http://localhost:${TEST_API_PORT}/ready`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      cwd: path.resolve(repoRoot, 'apps/web'),
      command: 'npx next start -p 3100',
      env: {
        NODE_ENV: 'production',
        PORT: String(TEST_WEB_PORT),
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_API_URL: `http://localhost:${TEST_API_PORT}`,
        INTERNAL_API_URL: `http://localhost:${TEST_API_PORT}`,
        JWT_ACCESS_SECRET: 'test_jwt_access_secret_super_secure_32_chars',
        JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_super_secure_32_chars',
        COOKIE_SECRET: 'test_cookie_secret_super_secure_32_chars',
      },
      url: `http://localhost:${TEST_WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
