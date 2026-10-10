import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.resolve(repoRoot, 'apps/web');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('[build-e2e] Ensuring @studyflow/shared is built...');
const sharedBuild = spawnSync(npmCmd, ['run', 'build:shared'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: isWindows,
});
if (sharedBuild.status !== 0) {
  console.error('[build-e2e] Failed to build @studyflow/shared');
  process.exit(sharedBuild.status || 1);
}

console.log('[build-e2e] Building Next.js into .next-e2e...');
const nextBuild = spawnSync(npxCmd, ['next', 'build'], {
  cwd: webDir,
  env: {
    ...process.env,
    NEXT_DIST_DIR: '.next-e2e',
    NODE_ENV: 'production',
  },
  stdio: 'inherit',
  shell: isWindows,
});

if (nextBuild.status !== 0) {
  console.error(`[build-e2e] Next.js E2E build failed with exit code ${nextBuild.status}`);
  process.exit(nextBuild.status || 1);
}

console.log('[build-e2e] Next.js E2E build (.next-e2e) completed successfully.');
