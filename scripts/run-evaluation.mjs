#!/usr/bin/env node

/**
 * StudyFlow AI Evaluation Forwarder
 *
 * Forwards execution to the unified official benchmark runner (scripts/run-ai-evaluation.ts)
 * ensuring zero divergence between package.json scripts and CLI invocations.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeExe = process.execPath;
const tsxCli = path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs');
const runnerPath = path.resolve(__dirname, 'run-ai-evaluation.ts');
const args = process.argv.slice(2);

const result = spawnSync(nodeExe, [tsxCli, runnerPath, ...args], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
