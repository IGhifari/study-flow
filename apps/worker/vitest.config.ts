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
      REDIS_URL: process.env.REDIS_URL_TEST || process.env.REDIS_URL || 'redis://localhost:6379',
      EMAIL_DRIVER: 'mock',
    },
  },
});
