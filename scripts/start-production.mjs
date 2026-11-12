import { spawn } from 'node:child_process';

console.log('[PROD-RUNNER] Starting StudyFlow API and Worker...');

const api = spawn('node', ['apps/api/dist/server.js'], { stdio: 'inherit' });
const worker = spawn('node', ['apps/worker/dist/worker.js'], { stdio: 'inherit' });

api.on('exit', (code) => {
  console.error(`[PROD-RUNNER] API exited with code ${code}`);
  process.exit(code ?? 1);
});

worker.on('exit', (code) => {
  console.error(`[PROD-RUNNER] Worker exited with code ${code}`);
});

const shutdown = (signal) => {
  console.log(`[PROD-RUNNER] Received ${signal}, shutting down child processes...`);
  api.kill(signal);
  worker.kill(signal);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
