#!/usr/bin/env node

/**
 * StudyFlow E2E Configuration Isolation Verifier Forwarder
 *
 * Runs the targeted E2E configuration test (scripts/test-e2e-config.ts)
 * ensuring explicit test targets and zero leakage of development URLs.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeExe = process.execPath;
const tsxCli = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
const runnerPath = path.resolve(__dirname, 'test-e2e-config.ts');
const args = process.argv.slice(2);

const result = spawnSync(nodeExe, [tsxCli, runnerPath, ...args], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
