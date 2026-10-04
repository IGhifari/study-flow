import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ||
        'postgresql://studyflow_user:studyflow_dev_password@localhost:5433/studyflow_test?schema=public',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      CORS_ORIGIN: 'http://localhost:3000',
      JWT_ACCESS_SECRET: 'test_jwt_access_secret_super_secure_32_chars',
      JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_super_secure_32_chars',
      COOKIE_SECRET: 'test_cookie_secret_super_secure_32_chars',
    },
  },
});
