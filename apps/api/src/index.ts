import './config/env.js';
import { createApp } from './app.js';

/**
 * Serverless Express entry point for Vercel Functions.
 * Instantiates the Express application once per cold start without starting
 * an HTTP listener (`app.listen`) or long-lived background timers/workers.
 */
const app = createApp();

export { app, createApp };
export default app;
