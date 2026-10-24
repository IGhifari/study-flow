import type { Express } from 'express';
import appInstance, { createApp } from '../src/index.js';

/**
 * Vercel Serverless Function entry point (`apps/api/api/index.ts`).
 * Exports the Express application instance as the default export required by
 * `@vercel/node` while keeping `src/app.ts` strictly as the app factory module.
 */
const app: Express = appInstance;

export { app, createApp };
export default app;
